create table if not exists users (
  id text primary key,
  email text not null unique,
  display_name text,
  password_hash text not null,
  password_salt text not null,
  password_iterations integer not null default 100000,
  email_verified integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists email_verification_tokens (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at text not null,
  used_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists content_items (
  id text primary key,
  user_id text references users(id) on delete cascade,
  source_type text not null,
  source_name text not null,
  title text not null,
  author text,
  original_url text,
  markdown text,
  plain_text text,
  excerpt text not null default '',
  tags text not null default '[]',
  estimated_minutes integer not null default 1,
  word_count integer not null default 0,
  status text not null default 'unread',
  saved_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists content_favorites (
  user_id text not null references users(id) on delete cascade,
  item_id text not null references content_items(id) on delete cascade,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (user_id, item_id)
);

create index if not exists users_email_idx on users(email);
create index if not exists sessions_token_hash_idx on sessions(token_hash);
create index if not exists verification_token_hash_idx on email_verification_tokens(token_hash);
create index if not exists content_items_user_status_idx on content_items(user_id, status, saved_at desc);
