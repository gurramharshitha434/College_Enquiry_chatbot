-- CampusConnect database schema
-- Run this script in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  email text not null check (char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 20),
  category text not null check (category in ('Admissions', 'Courses', 'Fees & Scholarships', 'Campus Facilities', 'Other')),
  message text not null check (char_length(trim(message)) between 5 and 2000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists enquiries_created_at_idx on public.enquiries (created_at desc);
create index if not exists enquiries_category_idx on public.enquiries (category);
create index if not exists enquiries_status_idx on public.enquiries (status);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists enquiries_set_updated_at on public.enquiries;
create trigger enquiries_set_updated_at
before update on public.enquiries
for each row execute function public.set_updated_at();

-- This starter app uses the Supabase secret/service-role key only on the server.
-- RLS is enabled and browser roles receive no direct access. Server-side access
-- bypasses RLS, so keep the key private and add authorization before admin routes.
alter table public.enquiries enable row level security;
