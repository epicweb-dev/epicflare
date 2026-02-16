import {
	bigint,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core'

export const users = pgTable(
	'users',
	{
		id: serial('id').primaryKey(),
		username: text('username').notNull(),
		email: text('email').notNull(),
		passwordHash: text('password_hash').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		usersUsernameUnique: uniqueIndex('users_username_unique').on(
			table.username,
		),
		usersEmailUnique: uniqueIndex('users_email_unique').on(table.email),
		usersUsernameIndex: index('idx_users_username').on(table.username),
		usersEmailIndex: index('idx_users_email').on(table.email),
	}),
)

export const passwordResets = pgTable(
	'password_resets',
	{
		id: serial('id').primaryKey(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull(),
		expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		passwordResetsTokenHashUnique: uniqueIndex(
			'password_resets_token_hash_unique',
		).on(table.tokenHash),
		passwordResetsUserIdIndex: index('idx_password_resets_user_id').on(
			table.userId,
		),
		passwordResetsTokenHashIndex: index('idx_password_resets_token_hash').on(
			table.tokenHash,
		),
	}),
)
