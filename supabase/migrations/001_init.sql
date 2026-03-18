-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  email text not null default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Meeting format type
create type public.meeting_format as enum (
  'FIP', 'FI', 'P+D', 'D', 'WND', 'W+D', 'PR', 'O', 'BRK'
);

-- Meeting status type
create type public.meeting_status as enum (
  'PLANNED', 'IN_PROGRESS', 'COMPLETED'
);

-- Item status type
create type public.item_status as enum (
  'pending', 'in_progress', 'done', 'skipped'
);

-- Templates
create table public.templates (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text default '',
  start_time text default '09:00' not null,  -- HH:MM
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.templates enable row level security;

create policy "Users can view own templates"
  on public.templates for select
  using (auth.uid() = user_id);

create policy "Users can insert own templates"
  on public.templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update own templates"
  on public.templates for update
  using (auth.uid() = user_id);

create policy "Users can delete own templates"
  on public.templates for delete
  using (auth.uid() = user_id);

-- Template items
create table public.template_items (
  id uuid default uuid_generate_v4() primary key,
  template_id uuid references public.templates(id) on delete cascade not null,
  position integer not null default 0,
  title text not null,
  duration_minutes integer not null default 30,
  format public.meeting_format not null default 'O',
  objective text default '',
  illustration text default '',
  approach text default '',
  is_break boolean default false not null,
  notes text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.template_items enable row level security;

create policy "Users can view own template items"
  on public.template_items for select
  using (
    exists (
      select 1 from public.templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );

create policy "Users can insert own template items"
  on public.template_items for insert
  with check (
    exists (
      select 1 from public.templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );

create policy "Users can update own template items"
  on public.template_items for update
  using (
    exists (
      select 1 from public.templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );

create policy "Users can delete own template items"
  on public.template_items for delete
  using (
    exists (
      select 1 from public.templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );

-- Meetings
create table public.meetings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  template_id uuid references public.templates(id) on delete set null,
  title text not null,
  subtitle text default '',
  date date not null,
  start_time text default '09:00' not null,  -- HH:MM
  location text default '',
  facilitator text default '',
  participants text[] default '{}',
  status public.meeting_status default 'PLANNED' not null,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  notes text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.meetings enable row level security;

create policy "Users can view own meetings"
  on public.meetings for select
  using (auth.uid() = user_id);

create policy "Users can insert own meetings"
  on public.meetings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own meetings"
  on public.meetings for update
  using (auth.uid() = user_id);

create policy "Users can delete own meetings"
  on public.meetings for delete
  using (auth.uid() = user_id);

-- Meeting items
create table public.meeting_items (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  position integer not null default 0,
  title text not null,
  duration_minutes integer not null default 30,
  format public.meeting_format not null default 'O',
  objective text default '',
  illustration text default '',
  approach text default '',
  is_break boolean default false not null,
  notes text default '',
  status public.item_status default 'pending' not null,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  actual_duration_minutes integer,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.meeting_items enable row level security;

create policy "Users can view own meeting items"
  on public.meeting_items for select
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.user_id = auth.uid()
    )
  );

create policy "Users can insert own meeting items"
  on public.meeting_items for insert
  with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.user_id = auth.uid()
    )
  );

create policy "Users can update own meeting items"
  on public.meeting_items for update
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.user_id = auth.uid()
    )
  );

create policy "Users can delete own meeting items"
  on public.meeting_items for delete
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.user_id = auth.uid()
    )
  );

-- Updated_at trigger function
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at before update on public.profiles for each row execute procedure public.update_updated_at_column();
create trigger update_templates_updated_at before update on public.templates for each row execute procedure public.update_updated_at_column();
create trigger update_template_items_updated_at before update on public.template_items for each row execute procedure public.update_updated_at_column();
create trigger update_meetings_updated_at before update on public.meetings for each row execute procedure public.update_updated_at_column();
create trigger update_meeting_items_updated_at before update on public.meeting_items for each row execute procedure public.update_updated_at_column();
