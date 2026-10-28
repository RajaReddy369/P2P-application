/**
 * Database Driver Module for Zero-Knowledge Encrypted Synchronization Backend.
 * Dynamically connects to PostgreSQL database via 'pg' Pool when available, or provides an isolated SQL engine for standalone execution.
 */

let Pool;
try {
  Pool = require('pg').Pool;
} catch (_) {
  Pool = null;
}

const crypto = require('crypto');

class DatabaseDriver {
  constructor() {
    this.usePostgres = false;
    this.pool = null;

    // Persistent database tables
    this.tables = {
      users: new Map(),               // id -> record
      devices: new Map(),             // id -> record
      conversations: new Map(),       // id -> record
      conversation_members: new Map(),// conv_id:user_id -> record
      messages: [],                   // [record]
      attachments: new Map(),         // id -> record
      sync_state: new Map(),          // device_id:conv_id -> record
      user_presence: new Map(),       // user_id -> { user_id, presence_status, last_seen, updated_at }
      otp_verifications: new Map(),   // id -> record
      qr_pairings: new Map(),         // pairing_id -> record
      user_sessions: new Map(),       // token -> { token, user_id, username, created_at }
    };

    this.sequenceCounter = 1;

    if (Pool && (process.env.DATABASE_URL || process.env.PGHOST)) {
      try {
        this.pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          host: process.env.PGHOST || 'localhost',
          port: parseInt(process.env.PGPORT || '5432', 10),
          user: process.env.PGUSER || 'postgres',
          password: process.env.PGPASSWORD || 'postgres',
          database: process.env.PGDATABASE || 'p2p_messenger',
        });
        this.usePostgres = true;
        console.log('[DB] Connected via PostgreSQL Connection Pool');

        // Dynamic Schema Migration
        this.pool.query(`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
          ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255);
          ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes TEXT;
          ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_number_key;

          CREATE TABLE IF NOT EXISTS user_sessions (
            token VARCHAR(255) PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            username VARCHAR(50) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS user_presence (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            presence_status VARCHAR(20) DEFAULT 'online',
            last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS otp_verifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID,
            target VARCHAR(255) NOT NULL,
            target_type VARCHAR(20) NOT NULL,
            otp_hash VARCHAR(255) NOT NULL,
            purpose VARCHAR(50) NOT NULL,
            attempts INT DEFAULT 0,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS qr_pairings (
            pairing_id VARCHAR(64) PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'pending',
            token TEXT,
            device_info VARCHAR(255),
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `).catch((err) => console.warn('[DB Migration Notice]', err.message));
      } catch (err) {
        console.warn('[DB] PostgreSQL pool initialization failed, using native SQL engine:', err.message);
      }
    }
  }

  // --- Password Hashing (PBKDF2 with Salt) ---
  static hashPassword(password, salt) {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, s, 10000, 64, 'sha512').toString('hex');
    return `${s}:${hash}`;
  }

  static verifyPassword(password, storedHash) {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(originalHash), Buffer.from(hash));
  }

  // --- Users Operations ---
  async createUser({ username, display_name, country_code, phone_number, email, password, public_identity_key, avatar_url }) {
    const userId = crypto.randomUUID();
    const passwordHash = DatabaseDriver.hashPassword(password);
    const createdAt = new Date().toISOString();
    const displayName = display_name || username;
    const countryCode = country_code || '+91';
    const avatarUrl = avatar_url || null;
    const userEmail = email || null;

    if (this.usePostgres) {
      const res = await this.pool.query(
        `INSERT INTO users (id, username, display_name, country_code, phone_number, email, password_hash, public_identity_key, avatar_url, phone_verified, email_verified, two_factor_enabled, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, FALSE, FALSE, $10)
         RETURNING id, username, display_name, country_code, phone_number, email, avatar_url, phone_verified, email_verified, two_factor_enabled, public_identity_key, created_at`,
        [userId, username, displayName, countryCode, phone_number, userEmail, passwordHash, public_identity_key, avatarUrl, createdAt]
      );
      return res.rows[0];
    }

    const user = {
      id: userId,
      username,
      display_name: displayName,
      country_code: countryCode,
      phone_number,
      email: userEmail,
      password_hash: passwordHash,
      public_identity_key,
      avatar_url: avatarUrl,
      phone_verified: false,
      email_verified: false,
      two_factor_enabled: false,
      created_at: createdAt,
    };
    this.tables.users.set(userId, user);
    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      country_code: user.country_code,
      phone_number: user.phone_number,
      email: user.email,
      avatar_url: user.avatar_url,
      phone_verified: user.phone_verified,
      email_verified: user.email_verified,
      two_factor_enabled: user.two_factor_enabled,
      public_identity_key: user.public_identity_key,
      created_at: user.created_at,
    };
  }

  async getAllUsers() {
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT id, username, display_name, country_code, phone_number, email, avatar_url, phone_verified, email_verified, two_factor_enabled, public_identity_key, created_at FROM users ORDER BY username ASC');
      return res.rows;
    }

    return Array.from(this.tables.users.values()).map((u) => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name || u.username,
      country_code: u.country_code || '+91',
      phone_number: u.phone_number,
      email: u.email || null,
      avatar_url: u.avatar_url || null,
      phone_verified: !!u.phone_verified,
      email_verified: !!u.email_verified,
      two_factor_enabled: !!u.two_factor_enabled,
      public_identity_key: u.public_identity_key,
      created_at: u.created_at,
    }));
  }

  async searchUsers(query, excludeUserId = null) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    if (this.usePostgres) {
      const res = await this.pool.query(
        `SELECT id, username, display_name, country_code, avatar_url, public_identity_key, created_at
         FROM users
         WHERE (LOWER(username) LIKE $1 OR LOWER(display_name) LIKE $1 OR id::text = $2)
           ${excludeUserId ? 'AND id != $3' : ''}
         ORDER BY display_name ASC
         LIMIT 20`,
        excludeUserId ? [`%${q}%`, q, excludeUserId] : [`%${q}%`, q]
      );
      return res.rows;
    }

    return Array.from(this.tables.users.values())
      .filter((u) => {
        if (excludeUserId && u.id === excludeUserId) return false;
        return (
          u.username.toLowerCase().includes(q) ||
          (u.display_name && u.display_name.toLowerCase().includes(q)) ||
          u.id === q
        );
      })
      .map((u) => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name || u.username,
        country_code: u.country_code || '+91',
        avatar_url: u.avatar_url || null,
        public_identity_key: u.public_identity_key,
        created_at: u.created_at,
      }))
      .slice(0, 20);
  }

  async updateUserProfile(userId, { display_name, avatar_url, email, two_factor_enabled }) {
    if (this.usePostgres) {
      const res = await this.pool.query(
        `UPDATE users
         SET display_name = COALESCE($1, display_name),
             avatar_url = COALESCE($2, avatar_url),
             email = COALESCE($3, email),
             two_factor_enabled = COALESCE($4, two_factor_enabled),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING id, username, display_name, country_code, phone_number, email, avatar_url, phone_verified, email_verified, two_factor_enabled, public_identity_key, created_at`,
        [
          display_name !== undefined ? display_name : null,
          avatar_url !== undefined ? avatar_url : null,
          email !== undefined ? email : null,
          two_factor_enabled !== undefined ? two_factor_enabled : null,
          userId,
        ]
      );
      return res.rows[0] || null;
    }

    const u = this.tables.users.get(userId);
    if (!u) return null;
    if (display_name !== undefined && display_name !== null) u.display_name = display_name;
    if (avatar_url !== undefined && avatar_url !== null) u.avatar_url = avatar_url;
    if (email !== undefined && email !== null) u.email = email;
    if (two_factor_enabled !== undefined && two_factor_enabled !== null) u.two_factor_enabled = two_factor_enabled;
    u.updated_at = new Date().toISOString();
    return {
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      country_code: u.country_code,
      phone_number: u.phone_number,
      email: u.email,
      avatar_url: u.avatar_url || null,
      phone_verified: !!u.phone_verified,
      email_verified: !!u.email_verified,
      two_factor_enabled: !!u.two_factor_enabled,
      public_identity_key: u.public_identity_key,
      created_at: u.created_at,
    };
  }

  async setTotpSecret(userId, secret, recoveryCodesJson) {
    if (this.usePostgres) {
      const res = await this.pool.query(
        `UPDATE users
         SET totp_secret = $1,
             two_factor_enabled = TRUE,
             recovery_codes = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, username, display_name, country_code, phone_number, email, avatar_url, phone_verified, email_verified, two_factor_enabled, public_identity_key, created_at`,
        [secret, recoveryCodesJson, userId]
      );
      return res.rows[0] || null;
    }

    const u = this.tables.users.get(userId);
    if (!u) return null;
    u.totp_secret = secret;
    u.two_factor_enabled = true;
    u.recovery_codes = recoveryCodesJson;
    u.updated_at = new Date().toISOString();
    return {
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      country_code: u.country_code,
      phone_number: u.phone_number,
      email: u.email,
      avatar_url: u.avatar_url || null,
      phone_verified: !!u.phone_verified,
      email_verified: !!u.email_verified,
      two_factor_enabled: true,
      public_identity_key: u.public_identity_key,
      created_at: u.created_at,
    };
  }

  async disableTotp(userId) {
    if (this.usePostgres) {
      const res = await this.pool.query(
        `UPDATE users
         SET totp_secret = NULL,
             two_factor_enabled = FALSE,
             recovery_codes = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, username, display_name, country_code, phone_number, email, avatar_url, phone_verified, email_verified, two_factor_enabled, public_identity_key, created_at`,
        [userId]
      );
      return res.rows[0] || null;
    }

    const u = this.tables.users.get(userId);
    if (!u) return null;
    u.totp_secret = null;
    u.two_factor_enabled = false;
    u.recovery_codes = null;
    u.updated_at = new Date().toISOString();
    return {
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      country_code: u.country_code,
      phone_number: u.phone_number,
      email: u.email,
      avatar_url: u.avatar_url || null,
      phone_verified: !!u.phone_verified,
      email_verified: !!u.email_verified,
      two_factor_enabled: false,
      public_identity_key: u.public_identity_key,
      created_at: u.created_at,
    };
  }

  async updateRecoveryCodes(userId, recoveryCodesJson) {
    if (this.usePostgres) {
      await this.pool.query('UPDATE users SET recovery_codes = $1 WHERE id = $2', [recoveryCodesJson, userId]);
      return true;
    }
    const u = this.tables.users.get(userId);
    if (u) u.recovery_codes = recoveryCodesJson;
    return true;
  }

  async findUserByUsername(username) {
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT * FROM users WHERE username = $1', [username]);
      return res.rows[0] || null;
    }

    const u = Array.from(this.tables.users.values()).find((user) => user.username === username);
    if (!u) return null;
    return {
      ...u,
      display_name: u.display_name || u.username,
      country_code: u.country_code || '+91',
      avatar_url: u.avatar_url || null,
    };
  }

  async findUserById(userId) {
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT id, username, display_name, country_code, phone_number, email, avatar_url, phone_verified, email_verified, two_factor_enabled, public_identity_key, created_at FROM users WHERE id = $1', [userId]);
      return res.rows[0] || null;
    }

    const u = this.tables.users.get(userId);
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      display_name: u.display_name || u.username,
      country_code: u.country_code || '+91',
      phone_number: u.phone_number,
      email: u.email || null,
      avatar_url: u.avatar_url || null,
      phone_verified: !!u.phone_verified,
      email_verified: !!u.email_verified,
      two_factor_enabled: !!u.two_factor_enabled,
      public_identity_key: u.public_identity_key,
      created_at: u.created_at,
    };
  }

  // --- Devices Operations ---
  async registerDevice({ user_id, device_name, device_type, public_device_key }) {
    const deviceId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    if (this.usePostgres) {
      const res = await this.pool.query(
        `INSERT INTO devices (id, user_id, device_name, device_type, public_device_key, is_trusted, last_seen, created_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6, $6)
         RETURNING *`,
        [deviceId, user_id, device_name, device_type, public_device_key, createdAt]
      );
      return res.rows[0];
    }

    const device = {
      id: deviceId,
      user_id,
      device_name,
      device_type,
      public_device_key,
      is_trusted: true,
      last_seen: createdAt,
      created_at: createdAt,
    };
    this.tables.devices.set(deviceId, device);
    return device;
  }

  async getUserDevices(userId) {
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      return res.rows;
    }

    return Array.from(this.tables.devices.values()).filter((d) => d.user_id === userId);
  }

  // --- Conversations & Membership Operations ---
  async findDirectConversation(userAId, userBId) {
    let conv = null;
    if (this.usePostgres) {
      const res = await this.pool.query(
        `SELECT c.id, c.type, c.created_at, c.updated_at, cmA.encrypted_conversation_key
         FROM conversations c
         JOIN conversation_members cmA ON c.id = cmA.conversation_id AND cmA.user_id = $1
         JOIN conversation_members cmB ON c.id = cmB.conversation_id AND cmB.user_id = $2
         WHERE c.type = 'direct'
         LIMIT 1`,
        [userAId, userBId]
      );
      conv = res.rows[0] || null;
    } else {
      for (const c of this.tables.conversations.values()) {
        if (c.type === 'direct') {
          const hasA = this.tables.conversation_members.has(`${c.id}:${userAId}`);
          const hasB = this.tables.conversation_members.has(`${c.id}:${userBId}`);
          if (hasA && hasB) {
            const cmA = this.tables.conversation_members.get(`${c.id}:${userAId}`);
            conv = {
              id: c.id,
              type: c.type,
              created_at: c.created_at,
              updated_at: c.updated_at,
              encrypted_conversation_key: cmA ? cmA.encrypted_conversation_key : null,
            };
            break;
          }
        }
      }
    }

    if (conv) {
      const recipientUser = await this.findUserById(userBId);
      if (recipientUser) {
        conv.other_user_id = recipientUser.id;
        conv.other_username = recipientUser.username;
        conv.other_display_name = recipientUser.display_name || recipientUser.username;
        conv.peer = {
          id: recipientUser.id,
          username: recipientUser.username,
          display_name: recipientUser.display_name || recipientUser.username,
          avatar_url: recipientUser.avatar_url || null,
          presence: 'ONLINE',
          last_seen_at: recipientUser.created_at,
        };
      }
    }
    return conv;
  }

  async createConversation({ type, creator_user_id, recipient_user_id, encrypted_key_creator, encrypted_key_recipient }) {
    if (recipient_user_id) {
      const existing = await this.findDirectConversation(creator_user_id, recipient_user_id);
      if (existing) {
        return existing;
      }
    }

    const convId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    let recipientUser = null;
    if (recipient_user_id) {
      recipientUser = await this.findUserById(recipient_user_id);
    }

    const peerObj = recipientUser ? {
      id: recipientUser.id,
      username: recipientUser.username,
      display_name: recipientUser.display_name || recipientUser.username,
      avatar_url: recipientUser.avatar_url || null,
      presence: 'ONLINE',
      last_seen_at: recipientUser.created_at,
    } : null;

    if (this.usePostgres) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO conversations (id, type, created_at, updated_at) VALUES ($1, $2, $3, $3)`,
          [convId, type || 'direct', createdAt]
        );
        await client.query(
          `INSERT INTO conversation_members (conversation_id, user_id, encrypted_conversation_key, role, joined_at)
           VALUES ($1, $2, $3, 'owner', $4)`,
          [convId, creator_user_id, encrypted_key_creator, createdAt]
        );
        if (recipient_user_id) {
          await client.query(
            `INSERT INTO conversation_members (conversation_id, user_id, encrypted_conversation_key, role, joined_at)
             VALUES ($1, $2, $3, 'member', $4)`,
            [convId, recipient_user_id, encrypted_key_recipient, createdAt]
          );
        }
        await client.query('COMMIT');
        return {
          id: convId,
          type: type || 'direct',
          created_at: createdAt,
          encrypted_conversation_key: encrypted_key_creator,
          other_user_id: recipientUser?.id,
          other_username: recipientUser?.username,
          other_display_name: recipientUser?.display_name || recipientUser?.username,
          peer: peerObj,
        };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const conv = { id: convId, type: type || 'direct', created_at: createdAt, updated_at: createdAt };
    this.tables.conversations.set(convId, conv);

    this.tables.conversation_members.set(`${convId}:${creator_user_id}`, {
      conversation_id: convId,
      user_id: creator_user_id,
      encrypted_conversation_key: encrypted_key_creator,
      role: 'owner',
      joined_at: createdAt,
    });

    if (recipient_user_id) {
      this.tables.conversation_members.set(`${convId}:${recipient_user_id}`, {
        conversation_id: convId,
        user_id: recipient_user_id,
        encrypted_conversation_key: encrypted_key_recipient,
        role: 'member',
        joined_at: createdAt,
      });
    }

    return {
      ...conv,
      encrypted_conversation_key: encrypted_key_creator,
      other_user_id: recipientUser?.id,
      other_username: recipientUser?.username,
      other_display_name: recipientUser?.display_name || recipientUser?.username,
      peer: peerObj,
    };
  }

  async getMemberEnvelope(userId, conversationId) {
    if (this.usePostgres) {
      const res = await this.pool.query(
        `SELECT encrypted_conversation_key FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
      );
      return res.rows[0] ? res.rows[0].encrypted_conversation_key : null;
    }

    const member = this.tables.conversation_members.get(`${conversationId}:${userId}`);
    return member ? member.encrypted_conversation_key : null;
  }

  async isUserConversationMember(userId, conversationId) {
    if (this.usePostgres) {
      const res = await this.pool.query(
        'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, userId]
      );
      return res.rows.length > 0;
    }

    return this.tables.conversation_members.has(`${conversationId}:${userId}`);
  }

  // --- Presence Operations ---
  async updatePresence(userId, status = 'online') {
    const updatedAt = new Date().toISOString();
    const record = {
      user_id: userId,
      presence_status: status,
      last_seen: updatedAt,
      updated_at: updatedAt,
    };

    if (this.usePostgres) {
      const res = await this.pool.query(
        `INSERT INTO user_presence (user_id, presence_status, last_seen, updated_at)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (user_id)
         DO UPDATE SET presence_status = EXCLUDED.presence_status, last_seen = EXCLUDED.last_seen, updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [userId, status, updatedAt]
      );
      return res.rows[0];
    }

    this.tables.user_presence.set(userId, record);
    return record;
  }

  async getPresence(userId) {
    if (this.usePostgres) {
      const res = await this.pool.query('SELECT * FROM user_presence WHERE user_id = $1', [userId]);
      return res.rows[0] || { user_id: userId, presence_status: 'online', last_seen: new Date().toISOString() };
    }

    return this.tables.user_presence.get(userId) || { user_id: userId, presence_status: 'online', last_seen: new Date().toISOString() };
  }

  async getUserConversations(userId) {
    let rows = [];

    if (this.usePostgres) {
      const res = await this.pool.query(
        `SELECT
           c.id, c.type, c.created_at, c.updated_at, cm.encrypted_conversation_key,
           other_u.id AS other_user_id,
           other_u.username AS other_username,
           other_u.display_name AS other_display_name,
           other_u.avatar_url AS other_avatar_url,
           COALESCE(up.presence_status, 'online') AS other_presence_status,
           COALESCE(up.last_seen, c.updated_at) AS other_last_seen,
           lm.encrypted_payload AS last_msg_payload,
           lm.iv AS last_msg_iv,
           lm.created_at AS last_msg_created_at
         FROM conversations c
         JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = $1
         LEFT JOIN conversation_members other_cm ON c.id = other_cm.conversation_id AND other_cm.user_id != $1
         LEFT JOIN users other_u ON other_cm.user_id = other_u.id
         LEFT JOIN user_presence up ON other_u.id = up.user_id
         LEFT JOIN LATERAL (
           SELECT encrypted_payload, iv, created_at
           FROM messages
           WHERE conversation_id = c.id
           ORDER BY sequence_number DESC
           LIMIT 1
         ) lm ON true
         ORDER BY c.updated_at DESC`,
        [userId]
      );
      rows = res.rows;
    } else {
      const userMemberships = Array.from(this.tables.conversation_members.values()).filter((m) => m.user_id === userId);
      rows = userMemberships.map((m) => {
        const conv = this.tables.conversations.get(m.conversation_id);
        const allMembers = Array.from(this.tables.conversation_members.values()).filter((mem) => mem.conversation_id === m.conversation_id);
        const otherMem = allMembers.find((mem) => mem.user_id !== userId);
        const otherUser = otherMem ? this.tables.users.get(otherMem.user_id) : null;
        const presence = otherUser ? (this.tables.user_presence.get(otherUser.id) || { presence_status: 'online', last_seen: conv.updated_at }) : { presence_status: 'online', last_seen: conv.updated_at };

        const convMsgs = this.tables.messages.filter((msg) => msg.conversation_id === m.conversation_id);
        convMsgs.sort((a, b) => b.sequence_number - a.sequence_number);
        const lastMsg = convMsgs[0] || null;

        return {
          id: conv.id,
          type: conv.type,
          encrypted_conversation_key: m.encrypted_conversation_key,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          other_user_id: otherUser ? otherUser.id : null,
          other_username: otherUser ? otherUser.username : null,
          other_display_name: otherUser ? (otherUser.display_name || otherUser.username) : null,
          other_avatar_url: otherUser ? (otherUser.avatar_url || null) : null,
          other_presence_status: presence.presence_status,
          other_last_seen: presence.last_seen,
          last_msg_payload: lastMsg ? lastMsg.encrypted_payload : null,
          last_msg_iv: lastMsg ? lastMsg.iv : null,
          last_msg_created_at: lastMsg ? lastMsg.created_at : null,
        };
      });
    }

    return rows.map((r) => ({
      id: r.id,
      type: r.type || 'direct',
      encrypted_conversation_key: r.encrypted_conversation_key,
      created_at: r.created_at,
      updated_at: r.updated_at,
      // Backward compatibility fields
      other_user_id: r.other_user_id,
      other_username: r.other_username,
      other_display_name: r.other_display_name || r.other_username,
      other_presence_status: r.other_presence_status,
      other_last_seen: r.other_last_seen,
      // Structured peer object required by Requirement 9
      peer: r.other_user_id ? {
        id: r.other_user_id,
        username: r.other_username,
        display_name: r.other_display_name || r.other_username,
        avatar_url: r.other_avatar_url || null,
        presence: (r.other_presence_status || 'online').toUpperCase(),
        last_seen_at: r.other_last_seen,
      } : null,
      last_message: r.last_msg_payload ? {
        encrypted_payload: r.last_msg_payload,
        iv: r.last_msg_iv,
        created_at: r.last_msg_created_at,
      } : null,
      unread_count: 0,
    }));
  }

  // --- Encrypted Message Operations ---
  async saveEncryptedMessage({ conversation_id, sender_id, sender_device_id, encrypted_payload, iv, message_type }) {
    const msgId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const seqNum = this.sequenceCounter++;

    if (this.usePostgres) {
      const res = await this.pool.query(
        `INSERT INTO messages (id, conversation_id, sender_id, sender_device_id, encrypted_payload, iv, message_type, sequence_number, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, DEFAULT, $8)
         RETURNING *`,
        [msgId, conversation_id, sender_id, sender_device_id || null, encrypted_payload, iv, message_type || 'text', createdAt]
      );

      await this.pool.query('UPDATE conversations SET updated_at = $1 WHERE id = $2', [createdAt, conversation_id]);
      return res.rows[0];
    }

    const record = {
      id: msgId,
      conversation_id,
      sender_id,
      sender_device_id: sender_device_id || null,
      encrypted_payload,
      iv,
      message_type: message_type || 'text',
      sequence_number: seqNum,
      created_at: createdAt,
    };

    this.tables.messages.push(record);
    const conv = this.tables.conversations.get(conversation_id);
    if (conv) conv.updated_at = createdAt;

    return record;
  }

  async getPaginatedMessages(conversationId, limit = 30, beforeSequence = null) {
    if (this.usePostgres) {
      let query = `SELECT * FROM messages WHERE conversation_id = $1`;
      const params = [conversationId];

      if (beforeSequence) {
        params.push(beforeSequence);
        query += ` AND sequence_number < $2 ORDER BY sequence_number DESC LIMIT $3`;
        params.push(limit);
      } else {
        query += ` ORDER BY sequence_number DESC LIMIT $2`;
        params.push(limit);
      }

      const res = await this.pool.query(query, params);
      return res.rows.reverse();
    }

    let convMsgs = this.tables.messages.filter((m) => m.conversation_id === conversationId);
    if (beforeSequence) {
      convMsgs = convMsgs.filter((m) => m.sequence_number < beforeSequence);
    }
    convMsgs.sort((a, b) => b.sequence_number - a.sequence_number);
    const sliced = convMsgs.slice(0, limit);
    return sliced.reverse();
  }

  // --- Synchronization State Operations ---
  async getSyncState(deviceId, conversationId) {
    if (this.usePostgres) {
      const res = await this.pool.query(
        'SELECT * FROM sync_state WHERE device_id = $1 AND conversation_id = $2',
        [deviceId, conversationId]
      );
      return res.rows[0] || null;
    }

    return this.tables.sync_state.get(`${deviceId}:${conversationId}`) || null;
  }

  async updateSyncState(deviceId, conversationId, lastSyncedSequence) {
    const updatedAt = new Date().toISOString();

    if (this.usePostgres) {
      const res = await this.pool.query(
        `INSERT INTO sync_state (device_id, conversation_id, last_synced_sequence, last_sync_time)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (device_id, conversation_id)
         DO UPDATE SET last_synced_sequence = EXCLUDED.last_synced_sequence, last_sync_time = EXCLUDED.last_sync_time
         RETURNING *`,
        [deviceId, conversationId, lastSyncedSequence, updatedAt]
      );
      return res.rows[0];
    }

    const record = {
      device_id: deviceId,
      conversation_id: conversationId,
      last_synced_sequence: lastSyncedSequence,
      last_sync_time: updatedAt,
    };
    this.tables.sync_state.set(`${deviceId}:${conversationId}`, record);
    return record;
  }

  // --- OTP Verification Operations ---
  async checkOtpCooldown({ target, purpose, cooldownSeconds = 45 }) {
    const now = Date.now();
    const cutoff = new Date(now - cooldownSeconds * 1000).toISOString();

    if (this.usePostgres) {
      const res = await this.pool.query(
        `SELECT created_at FROM otp_verifications
         WHERE target = $1 AND purpose = $2 AND created_at > $3
         ORDER BY created_at DESC LIMIT 1`,
        [target, purpose, cutoff]
      );
      if (res.rows.length > 0) {
        const createdMs = new Date(res.rows[0].created_at).getTime();
        const elapsedSec = Math.floor((now - createdMs) / 1000);
        const retryAfter = Math.max(1, cooldownSeconds - elapsedSec);
        return { onCooldown: true, retryAfterSeconds: retryAfter };
      }
      return { onCooldown: false, retryAfterSeconds: 0 };
    }

    const matching = Array.from(this.tables.otp_verifications.values()).filter(
      (r) => r.target === target && r.purpose === purpose && new Date(r.created_at).getTime() > (now - cooldownSeconds * 1000)
    );
    if (matching.length > 0) {
      matching.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const createdMs = new Date(matching[0].created_at).getTime();
      const elapsedSec = Math.floor((now - createdMs) / 1000);
      const retryAfter = Math.max(1, cooldownSeconds - elapsedSec);
      return { onCooldown: true, retryAfterSeconds: retryAfter };
    }
    return { onCooldown: false, retryAfterSeconds: 0 };
  }

  async createOtp({ userId, target, target_type, otp, purpose, ttlMinutes = 5 }) {
    const id = crypto.randomUUID();
    const otpHash = DatabaseDriver.hashPassword(otp);
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    if (this.usePostgres) {
      // Invalidate previous active OTPs for same target and purpose
      await this.pool.query(
        `DELETE FROM otp_verifications WHERE target = $1 AND purpose = $2`,
        [target, purpose]
      );

      await this.pool.query(
        `INSERT INTO otp_verifications (id, user_id, target, target_type, otp_hash, purpose, attempts, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8)`,
        [id, userId || null, target, target_type, otpHash, purpose, expiresAt, createdAt]
      );
      return { id, target, expiresAt };
    }

    // Clear previous OTPs in native engine
    for (const [key, rec] of this.tables.otp_verifications.entries()) {
      if (rec.target === target && rec.purpose === purpose) {
        this.tables.otp_verifications.delete(key);
      }
    }

    const record = { id, user_id: userId || null, target, target_type, otp_hash: otpHash, purpose, attempts: 0, expires_at: expiresAt, created_at: createdAt };
    this.tables.otp_verifications.set(id, record);
    return record;
  }

  async verifyOtp({ target, otp, purpose }) {
    const now = new Date().toISOString();

    if (this.usePostgres) {
      const res = await this.pool.query(
        `SELECT * FROM otp_verifications
         WHERE target = $1 AND purpose = $2 AND expires_at > $3
         ORDER BY created_at DESC LIMIT 1`,
        [target, purpose, now]
      );

      const record = res.rows[0];
      if (!record) {
        return { valid: false, reason: 'This verification code has expired. Please request a new one.' };
      }

      if (record.attempts >= 5) {
        await this.pool.query('DELETE FROM otp_verifications WHERE id = $1', [record.id]);
        return { valid: false, reason: 'Too many attempts. Verification code invalidated. Please request a new code.' };
      }

      const isMatch = DatabaseDriver.verifyPassword(otp, record.otp_hash);
      if (!isMatch) {
        const newAttempts = record.attempts + 1;
        if (newAttempts >= 5) {
          await this.pool.query('DELETE FROM otp_verifications WHERE id = $1', [record.id]);
          return { valid: false, reason: 'Too many attempts. Verification session invalidated. Please request a new code.' };
        }
        await this.pool.query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1', [record.id]);
        return { valid: false, reason: 'Incorrect verification code. Please try again.' };
      }

      await this.pool.query('DELETE FROM otp_verifications WHERE id = $1', [record.id]);

      // Update phone_verified flag for matching user
      if (record.user_id) {
        if (record.target_type === 'phone' || record.target.startsWith('+')) {
          await this.pool.query('UPDATE users SET phone_verified = TRUE WHERE id = $1', [record.user_id]);
        } else if (record.target_type === 'email') {
          await this.pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [record.user_id]);
        }
      } else {
        // Find user matching target phone number or email if user_id was not explicitly bound
        await this.pool.query(
          `UPDATE users SET phone_verified = TRUE WHERE CONCAT(country_code, phone_number) = $1 OR phone_number = $1`,
          [target]
        );
      }

      return { valid: true, userId: record.user_id };
    }

    const matching = Array.from(this.tables.otp_verifications.values()).filter(
      (r) => r.target === target && r.purpose === purpose && r.expires_at > now
    );
    matching.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const record = matching[0];

    if (!record) {
      return { valid: false, reason: 'This verification code has expired. Please request a new one.' };
    }

    if (record.attempts >= 5) {
      this.tables.otp_verifications.delete(record.id);
      return { valid: false, reason: 'Too many attempts. Verification code invalidated. Please request a new code.' };
    }

    const isMatch = DatabaseDriver.verifyPassword(otp, record.otp_hash);
    if (!isMatch) {
      record.attempts += 1;
      if (record.attempts >= 5) {
        this.tables.otp_verifications.delete(record.id);
        return { valid: false, reason: 'Too many attempts. Verification session invalidated. Please request a new code.' };
      }
      return { valid: false, reason: 'Incorrect verification code. Please try again.' };
    }

    this.tables.otp_verifications.delete(record.id);

    if (record.user_id) {
      const u = this.tables.users.get(record.user_id);
      if (u) {
        if (record.target_type === 'phone' || record.target.startsWith('+')) u.phone_verified = true;
        if (record.target_type === 'email') u.email_verified = true;
      }
    } else {
      for (const u of this.tables.users.values()) {
        const fullPhone = `${u.country_code || '+91'}${u.phone_number}`;
        if (fullPhone === target || u.phone_number === target) {
          u.phone_verified = true;
        }
      }
    }

    return { valid: true, userId: record.user_id };
  }

  // --- QR Code Session Pairings ---
  async createQrPairing(pairingId, ttlMinutes = 2) {
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    if (this.usePostgres) {
      await this.pool.query(
        `INSERT INTO qr_pairings (pairing_id, status, expires_at, created_at)
         VALUES ($1, 'pending', $2, $3)`,
        [pairingId, expiresAt, createdAt]
      );
      return { pairing_id: pairingId, status: 'pending', expires_at: expiresAt };
    }

    const record = { pairing_id: pairingId, status: 'pending', expires_at: expiresAt, created_at: createdAt };
    this.tables.qr_pairings.set(pairingId, record);
    return record;
  }

  async approveQrPairing(pairingId, userId, token, deviceInfo = 'Web Client') {
    const now = new Date().toISOString();

    if (this.usePostgres) {
      const res = await this.pool.query(
        `UPDATE qr_pairings
         SET status = 'approved', user_id = $1, token = $2, device_info = $3
         WHERE pairing_id = $4 AND status = 'pending' AND expires_at > $5
         RETURNING *`,
        [userId, token, deviceInfo, pairingId, now]
      );
      return res.rows[0] || null;
    }

    const r = this.tables.qr_pairings.get(pairingId);
    if (!r || r.status !== 'pending' || r.expires_at <= now) return null;

    r.status = 'approved';
    r.user_id = userId;
    r.token = token;
    r.device_info = deviceInfo;
    return r;
  }

  async getQrPairingStatus(pairingId) {
    const now = new Date().toISOString();

    if (this.usePostgres) {
      const res = await this.pool.query(`SELECT * FROM qr_pairings WHERE pairing_id = $1`, [pairingId]);
      const record = res.rows[0];
      if (!record) return { status: 'expired' };
      if (record.expires_at <= now && record.status === 'pending') return { status: 'expired' };
      return record;
    }

    const r = this.tables.qr_pairings.get(pairingId);
    if (!r) return { status: 'expired' };
    if (r.expires_at <= now && r.status === 'pending') return { status: 'expired' };
    return r;
  }

  // --- Device Management ---
  async deleteDevice(deviceId, userId) {
    if (this.usePostgres) {
      await this.pool.query('DELETE FROM devices WHERE id = $1 AND user_id = $2', [deviceId, userId]);
      return true;
    }

    const dev = this.tables.devices.get(deviceId);
    if (dev && dev.user_id === userId) {
      this.tables.devices.delete(deviceId);
      return true;
    }
    return false;
  }

  async revokeAllOtherDevices(currentDeviceId, userId) {
    if (this.usePostgres) {
      if (currentDeviceId) {
        await this.pool.query('DELETE FROM devices WHERE user_id = $1 AND id != $2', [userId, currentDeviceId]);
      } else {
        await this.pool.query('DELETE FROM devices WHERE user_id = $1', [userId]);
      }
      return true;
    }

    for (const [id, dev] of this.tables.devices.entries()) {
      if (dev.user_id === userId && id !== currentDeviceId) {
        this.tables.devices.delete(id);
      }
    }
    return true;
  }

  // --- Session Persistence Methods ---
  async createSession(token, userId, username) {
    if (this.usePostgres) {
      const res = await this.pool.query(
        `INSERT INTO user_sessions (token, user_id, username) VALUES ($1, $2, $3)
         ON CONFLICT (token) DO UPDATE SET user_id = $2, username = $3
         RETURNING *`,
        [token, userId, username]
      );
      return res.rows[0];
    }
    const rec = { token, user_id: userId, username, created_at: new Date().toISOString() };
    this.tables.user_sessions.set(token, rec);
    return rec;
  }

  async findSessionByToken(token) {
    if (this.usePostgres) {
      const res = await this.pool.query(`SELECT * FROM user_sessions WHERE token = $1`, [token]);
      return res.rows[0] || null;
    }
    return this.tables.user_sessions.get(token) || null;
  }

  async deleteSession(token) {
    if (this.usePostgres) {
      await this.pool.query(`DELETE FROM user_sessions WHERE token = $1`, [token]);
      return true;
    }
    this.tables.user_sessions.delete(token);
    return true;
  }
}

module.exports = new DatabaseDriver();
