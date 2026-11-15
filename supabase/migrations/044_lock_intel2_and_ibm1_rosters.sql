-- Migration 044: Lock INTEL-2 and IBM-1 student rosters and prevent cross-section leakage
-- Enforces strict section boundaries for INTEL-2 (AI & Analytics - B) and IBM-1 (Advanced AI - A).
-- Prevents INTEL-2 and IBM-1 students from being auto-enrolled or accessing INTEL-1.

begin;

-- 1. Create INTEL-2 student roster table
create table if not exists public.intel2_student_roster (
  roll_number smallint primary key check (roll_number between 1 and 70),
  enrollment_no text not null unique,
  email text not null unique,
  student_name text not null
);

alter table public.intel2_student_roster enable row level security;
revoke all on public.intel2_student_roster from public, anon, authenticated;

-- Ensure enrollment_no column exists on ibm1_student_roster
alter table public.ibm1_student_roster add column if not exists enrollment_no text;

-- 2. Populate INTEL-2 student roster
delete from public.intel2_student_roster;
insert into public.intel2_student_roster (roll_number, enrollment_no, email, student_name)
values
  (1, 'EN25CS3070003', 'en25cs3070003@medicaps.ac.in', 'AAYUSH SURYAVANSHI'),
  (2, 'EN25CS3070007', 'en25cs3070007@medicaps.ac.in', 'ADITYA SINGH RAJAWAT'),
  (3, 'EN25CS3070008', 'en25cs3070008@medicaps.ac.in', 'ADITYA SINGH TANWAR'),
  (4, 'EN25CS3070011', 'en25cs3070011@medicaps.ac.in', 'AJAY KUMAR YADAV'),
  (5, 'EN25CS3070014', 'en25cs3070014@medicaps.ac.in', 'AKSHRA NAGAR'),
  (6, 'EN25CS3070018', 'en25cs3070018@medicaps.ac.in', 'ANIKET SINGH'),
  (7, 'EN25CS3070019', 'en25cs3070019@medicaps.ac.in', 'ANMOL JAT'),
  (8, 'EN25CS3070020', 'en25cs3070020@medicaps.ac.in', 'ANURADHA MEWADA'),
  (9, 'EN25CS3070021', 'en25cs3070021@medicaps.ac.in', 'ARHAM JAIN'),
  (10, 'EN25CS3070026', 'en25cs3070026@medicaps.ac.in', 'AVNI NEMA'),
  (11, 'EN25CS3070027', 'en25cs3070027@medicaps.ac.in', 'AYUSH CHOURASIYA'),
  (12, 'EN25CS3070029', 'en25cs3070029@medicaps.ac.in', 'BHOOMI KANOJE'),
  (13, 'EN25CS3070032', 'en25cs3070032@medicaps.ac.in', 'CHITRANJAN PATEL'),
  (14, 'EN25CS3070034', 'en25cs3070034@medicaps.ac.in', 'DAKSHITA SHARMA'),
  (15, 'EN25CS3070037', 'en25cs3070037@medicaps.ac.in', 'DISHA JAPE'),
  (16, 'EN25CS3070039', 'en25cs3070039@medicaps.ac.in', 'DIXIT PRABHANSHU SANDEEP'),
  (17, 'EN25CS3070041', 'en25cs3070041@medicaps.ac.in', 'GURJAS SINGH KALRA'),
  (18, 'EN25CS3070042', 'en25cs3070042@medicaps.ac.in', 'HARISH BARFA'),
  (19, 'EN25CS3070048', 'en25cs3070048@medicaps.ac.in', 'KRISHNA GUPTA'),
  (20, 'EN25CS3070049', 'en25cs3070049@medicaps.ac.in', 'KUNAL CHOTHWANI'),
  (21, 'EN25CS3070050', 'en25cs3070050@medicaps.ac.in', 'LAKSHYA BHARGAW'),
  (22, 'EN25CS3070052', 'en25cs3070052@medicaps.ac.in', 'MAHEE SINGH'),
  (23, 'EN25CS3070057', 'en25cs3070057@medicaps.ac.in', 'MANSI VERMA'),
  (24, 'EN25CS3070058', 'en25cs3070058@medicaps.ac.in', 'MANTASH KHANDELWAL'),
  (25, 'EN25CS3070061', 'en25cs3070061@medicaps.ac.in', 'MUFADDAL MALAK'),
  (26, 'EN25CS3070065', 'en25cs3070065@medicaps.ac.in', 'NEET KAMAL TUTEJA'),
  (27, 'EN25CS3070067', 'en25cs3070067@medicaps.ac.in', 'NILAKSH TRIVEDI'),
  (28, 'EN25CS3070070', 'en25cs3070070@medicaps.ac.in', 'PAVITRA SHARMA'),
  (29, 'EN25CS3070071', 'en25cs3070071@medicaps.ac.in', 'PEEYUSH BISHT'),
  (30, 'EN25CS3070075', 'en25cs3070075@medicaps.ac.in', 'PRAGYAN JAIN'),
  (31, 'EN25CS3070076', 'en25cs3070076@medicaps.ac.in', 'PRAKHAR JAIN'),
  (32, 'EN25CS3070081', 'en25cs3070081@medicaps.ac.in', 'PRATYAKSHA YADAV'),
  (33, 'EN25CS3070083', 'en25cs3070083@medicaps.ac.in', 'PRIYA SINGH'),
  (34, 'EN25CS3070084', 'en25cs3070084@medicaps.ac.in', 'PRIYAL BARBHAYA'),
  (35, 'EN25CS3070085', 'en25cs3070085@medicaps.ac.in', 'PRIYAL THAKUR'),
  (36, 'EN25CS3070086', 'en25cs3070086@medicaps.ac.in', 'PURVI RAJWANI'),
  (37, 'EN25CS3070088', 'en25cs3070088@medicaps.ac.in', 'RANYA TUTEJA'),
  (38, 'EN25CS3070089', 'en25cs3070089@medicaps.ac.in', 'RHYTHM SIRKANUNGO'),
  (39, 'EN25CS3070091', 'en25cs3070091@medicaps.ac.in', 'RIDDHI ANIL DHOKLE'),
  (40, 'EN25CS3070093', 'en25cs3070093@medicaps.ac.in', 'ROHIT'),
  (41, 'EN25CS3070098', 'en25cs3070098@medicaps.ac.in', 'SAMRADDH DWIVEDI'),
  (42, 'EN25CS3070101', 'en25cs3070101@medicaps.ac.in', 'SHOURYADITYA CHANDEL'),
  (43, 'EN25CS3070102', 'en25cs3070102@medicaps.ac.in', 'SHREYA BAJPAI'),
  (44, 'EN25CS3070104', 'en25cs3070104@medicaps.ac.in', 'SIDDHARTH DASHORE'),
  (45, 'EN25CS3070105', 'en25cs3070105@medicaps.ac.in', 'SIDDHI SHARMA'),
  (46, 'EN25CS3070107', 'en25cs3070107@medicaps.ac.in', 'SUDHANSHU RATHORE'),
  (47, 'EN25CS3070111', 'en25cs3070111@medicaps.ac.in', 'TANISHKA YADAV'),
  (48, 'EN25CS3070113', 'en25cs3070113@medicaps.ac.in', 'UJJAWAL PATEL'),
  (49, 'EN25CS3070114', 'en25cs3070114@medicaps.ac.in', 'UJWAL PATIDAR'),
  (50, 'EN25CS3070115', 'en25cs3070115@medicaps.ac.in', 'URVASHI SOLANKI'),
  (51, 'EN25CS3070119', 'en25cs3070119@medicaps.ac.in', 'VAIDIKA SHARMA'),
  (52, 'EN25CS3070120', 'en25cs3070120@medicaps.ac.in', 'VEDEE BADOLE'),
  (53, 'EN25CS3070121', 'en25cs3070121@medicaps.ac.in', 'VIJAYRAJ SINGH'),
  (54, 'EN25CS3070122', 'en25cs3070122@medicaps.ac.in', 'VINIT CHOUHAN'),
  (55, 'EN25CS3070123', 'en25cs3070123@medicaps.ac.in', 'VISHAL PATIDAR'),
  (56, 'EN25CS3070125', 'en25cs3070125@medicaps.ac.in', 'YAGYAMITRA NAGAR'),
  (57, 'EN25CS3070127', 'en25cs3070127@medicaps.ac.in', 'ZAHRA BOHRA'),
  (58, 'EN25CS3070129', 'en25cs3070129@medicaps.ac.in', 'KANISHKA SAHU'),
  (59, 'EN25CS3070131', 'en25cs3070131@medicaps.ac.in', 'PRINCE RAGHUWANSHI'),
  (60, 'EN25CS3070133', 'en25cs3070133@medicaps.ac.in', 'AKSHAT SURYAWANSHI'),
  (61, 'EN25CS3070134', 'en25cs3070134@medicaps.ac.in', 'ANUSHREE PATIDAR'),
  (62, 'EN25CS3070135', 'en25cs3070135@medicaps.ac.in', 'JASMAN SINGH ARORA')
on conflict (roll_number) do update
set enrollment_no = excluded.enrollment_no,
    email = excluded.email,
    student_name = excluded.student_name;

-- 3. Populate IBM-1 student roster
delete from public.ibm1_student_roster;
insert into public.ibm1_student_roster (roll_number, enrollment_no, email, student_name)
values
  (1, 'EN25CS3090211', 'en25cs3090211@medicaps.ac.in', 'SIYA AGRAWAL'),
  (2, 'EN25CS3090013', 'en25cs3090013@medicaps.ac.in', 'AKANSH JADAM'),
  (3, 'EN25CS3090257', 'en25cs3090257@medicaps.ac.in', 'YUVRAJ SINGH SAKTAWAT'),
  (4, 'EN25CS3090227', 'en25cs3090227@medicaps.ac.in', 'SWASTIK TARE'),
  (5, 'EN25CS3090193', 'en25cs3090193@medicaps.ac.in', 'SAMAR MODAK'),
  (6, 'EN25CS3090005', 'en25cs3090005@medicaps.ac.in', 'AASHIKA DHAKAD'),
  (7, 'EN25CS3090097', 'en25cs3090097@medicaps.ac.in', 'KIRTI PATIDAR'),
  (8, 'EN25CS3090145', 'en25cs3090145@medicaps.ac.in', 'PARTH SHARMA'),
  (9, 'EN25CS3090125', 'en25cs3090125@medicaps.ac.in', 'NAIVEDHYA AGRAWAL'),
  (10, 'EN25CS3090160', 'en25cs3090160@medicaps.ac.in', 'PRINCE GUPTA'),
  (11, 'EN25CS3090118', 'en25cs3090118@medicaps.ac.in', 'MOHAMMAD ZAID SHAIKH'),
  (12, 'EN25CS3090199', 'en25cs3090199@medicaps.ac.in', 'SANVI SAKLECHA'),
  (13, 'EN25CS3090004', 'en25cs3090004@medicaps.ac.in', 'AARUSH RIMZA'),
  (14, 'EN25CS3090017', 'en25cs3090017@medicaps.ac.in', 'AKSHIT SINGH'),
  (15, 'EN25CS3090107', 'en25cs3090107@medicaps.ac.in', 'LAVISHA KHATRI'),
  (16, 'EN25CS3090209', 'en25cs3090209@medicaps.ac.in', 'SHUBHAM CHOUDHARY'),
  (17, 'EN25CS3090019', 'en25cs3090019@medicaps.ac.in', 'AMAAN KHAN'),
  (18, 'EN25CS3090153', 'en25cs3090153@medicaps.ac.in', 'PRAKHAR JAIN'),
  (19, 'EN25CS3090138', 'en25cs3090138@medicaps.ac.in', 'OJAS SHRIVASTAVA'),
  (20, 'EN25CS3090108', 'en25cs3090108@medicaps.ac.in', 'LUCKY CHOUHAN'),
  (21, 'EN25CS3090105', 'en25cs3090105@medicaps.ac.in', 'KUSHAL GOYAL'),
  (22, 'EN25CS3090210', 'en25cs3090210@medicaps.ac.in', 'SHUKH VANSH BHATIYA'),
  (23, 'EN25CS3090106', 'en25cs3090106@medicaps.ac.in', 'LABDHI JAIN'),
  (24, 'EN25CS3090081', 'en25cs3090081@medicaps.ac.in', 'IBRAHIM'),
  (25, 'EN25CS3090152', 'en25cs3090152@medicaps.ac.in', 'PRAKALP JAIN'),
  (26, 'EN25CS3090236', 'en25cs3090236@medicaps.ac.in', 'VAISHNAVI SAWNER'),
  (27, 'EN25CS3090256', 'en25cs3090256@medicaps.ac.in', 'Yuvraj singh Rajput'),
  (28, 'EN25CS3090072', 'en25cs3090072@medicaps.ac.in', 'HANSRAJ CHOUHAN'),
  (29, 'EN25CS3090014', 'en25cs3090014@medicaps.ac.in', 'AKRITI JAIN'),
  (30, 'EN25CS3090037', 'en25cs3090037@medicaps.ac.in', 'ARYAN PARASHAR'),
  (31, 'EN25CS3090101', 'en25cs3090101@medicaps.ac.in', 'KRITI PUNJABI'),
  (32, 'EN25CS3090054', 'en25cs3090054@medicaps.ac.in', 'DEEPAK KUSHWAHA'),
  (33, 'EN25CS3090031', 'en25cs3090031@medicaps.ac.in', 'ARGHO BISWAS'),
  (34, 'EN25CS3090213', 'en25cs3090213@medicaps.ac.in', 'SOUMY MAHAJAN'),
  (35, 'EN25CS3090248', 'en25cs3090248@medicaps.ac.in', 'VRADHI BHATIYA'),
  (36, 'EN25CS3090080', 'en25cs3090080@medicaps.ac.in', 'HITANSHU JAISWAL'),
  (37, 'EN25CS3090174', 'en25cs3090174@medicaps.ac.in', 'RAJ SENDHAV'),
  (38, 'EN25CS3090044', 'en25cs3090044@medicaps.ac.in', 'ATHARVA KALE'),
  (39, 'EN25CS3090087', 'en25cs3090087@medicaps.ac.in', 'LAVISHA KHATRI'),
  (40, 'EN25CS3090190', 'en25cs3090190@medicaps.ac.in', 'SAKSHAM JAIN'),
  (41, 'EN25CS3090007', 'en25cs3090007@medicaps.ac.in', 'ABHISHEK MEWADA'),
  (42, 'EN25CS3090230', 'en25cs3090230@medicaps.ac.in', 'TANISHKA JYOTISHI'),
  (43, 'EN25CS3090123', 'en25cs3090123@medicaps.ac.in', 'MOIZ EZZI BANKWALA'),
  (44, 'EN25CS3090254', 'en25cs3090254@medicaps.ac.in', 'YUGANT PATIDAR'),
  (45, 'EN25CS3090154', 'en25cs3090154@medicaps.ac.in', 'PRANAV KOLAMBE'),
  (46, 'EN25CS3090224', 'en25cs3090224@medicaps.ac.in', 'SUYOG JADHAV'),
  (47, 'EN25CS3090009', 'en25cs3090009@medicaps.ac.in', 'ABI ALI'),
  (48, 'EN25CS3090165', 'en25cs3090165@medicaps.ac.in', 'PRIYANSHI KUCHERIYA'),
  (49, 'EN25CS3090095', 'en25cs3090095@medicaps.ac.in', 'KHUSHI MAHESHWARI'),
  (50, 'EN25CS3090181', 'en25cs3090181@medicaps.ac.in', 'REHAN SHAIKH'),
  (51, 'EN25CS3090036', 'en25cs3090036@medicaps.ac.in', 'ARYAN KHARE'),
  (52, 'EN25CS3090021', 'en25cs3090021@medicaps.ac.in', 'AMOGH KARALE'),
  (53, 'EN25CS3090052', 'en25cs3090052@medicaps.ac.in', 'BHUMIKA YADAV'),
  (54, 'EN25CS3090240', 'en25cs3090240@medicaps.ac.in', 'VARUN CHANDSARKAR'),
  (55, 'EN25CS3090130', 'en25cs3090130@medicaps.ac.in', 'NEHAL CHHIPA'),
  (56, 'EN25CS3090082', 'en25cs3090082@medicaps.ac.in', 'ISHA PAYASI'),
  (57, 'EN25CS3090050', 'en25cs3090050@medicaps.ac.in', 'BHANUPRIYA YADAV'),
  (58, 'EN25CS3090239', 'en25cs3090239@medicaps.ac.in', 'VANSHIKA NAGPAL'),
  (59, 'EN25CS3090219', 'en25cs3090219@medicaps.ac.in', 'STUTI DWIVEDI'),
  (60, 'EN25CS3090167', 'en25cs3090167@medicaps.ac.in', 'PRIYANSHI SAH'),
  (61, 'EN25CS3090172', 'en25cs3090172@medicaps.ac.in', 'RAGHAV MAHESHWARI'),
  (62, 'EN25CS3090120', 'en25cs3090120@medicaps.ac.in', 'MOHD ALI KHAN'),
  (63, 'EN25CS3090064', 'en25cs3090064@medicaps.ac.in', 'EAKA NAGAR'),
  (64, 'EN25CS3090039', 'en25cs3090039@medicaps.ac.in', 'ARYAN UPADHYAY'),
  (65, 'EN25CS3090150', 'en25cs3090150@medicaps.ac.in', 'PIYUSH MANDLOI'),
  (66, 'EN25CS3090268', 'en25cs3090268@medicaps.ac.in', 'ISHA BADHE'),
  (67, 'EN25CS3090277', 'en25cs3090277@medicaps.ac.in', 'HIMANSHU PATIL')
on conflict (roll_number) do update
set enrollment_no = excluded.enrollment_no,
    email = excluded.email,
    student_name = excluded.student_name;

-- 4. Create bootstrap trigger for INTEL-2 students
create or replace function public.bootstrap_intel2_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  section_id uuid;
  roster_row public.intel2_student_roster%rowtype;
begin
  if new.email_confirmed_at is null or new.email is null then
    return new;
  end if;
  select * into roster_row from public.intel2_student_roster where email = lower(new.email);
  if not found then return new; end if;
  select id into section_id from public.classes where code = 'INTEL-2' and is_active;
  if section_id is null then return new; end if;

  insert into public.profiles (user_id, display_name)
  values (new.id, roster_row.student_name)
  on conflict (user_id) do update set display_name = excluded.display_name
  where public.profiles.display_name = '' or lower(public.profiles.display_name) = split_part(lower(new.email), '@', 1);

  insert into public.class_member_contacts (user_id, class_id, email)
  values (new.id, section_id, lower(new.email))
  on conflict (user_id, class_id) do nothing;

  if not exists (
    select 1 from public.class_memberships
    where class_id = section_id and role = 'student' and is_active
      and roll_number = roster_row.roll_number and user_id <> new.id
  ) then
    insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
    values (new.id, section_id, 'student', roster_row.roll_number, true)
    on conflict (user_id, class_id, role) do update
      set roll_number = excluded.roll_number, is_active = true;
  end if;
  return new;
end;
$$;

revoke all on function public.bootstrap_intel2_user() from public, anon, authenticated;

drop trigger if exists auth_user_bootstrap_intel2 on auth.users;
create trigger auth_user_bootstrap_intel2
after insert or update of email_confirmed_at on auth.users
for each row execute function public.bootstrap_intel2_user();

-- 5. Update bootstrap_intel1_user to strictly block INTEL-2 and IBM students
create or replace function public.bootstrap_intel1_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class uuid;
begin
  -- Exclude INTEL-2 students
  if exists (
    select 1 from public.intel2_student_roster
    where email = lower(new.email)
  ) then
    return new;
  end if;

  -- Exclude IBM-1 students
  if exists (
    select 1 from public.ibm1_student_roster
    where email = lower(new.email)
  ) then
    return new;
  end if;

  -- Exclude any student already in an IBM section or INTEL-2
  if exists (
    select 1 from public.class_memberships m
    join public.classes c on c.id = m.class_id
    where m.user_id = new.id and c.code in ('INTEL-2', 'IBM-1', 'IBM-2', 'IBM-3', 'IBM-4')
  ) then
    return new;
  end if;

  select c.id into target_class
  from public.classes c
  where c.code = 'INTEL-1' and c.is_active
  limit 1;

  if target_class is not null then
    insert into public.profiles (user_id, display_name)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1))
    )
    on conflict (user_id) do update
      set display_name = case when public.profiles.display_name = '' then excluded.display_name else public.profiles.display_name end;

    insert into public.class_member_contacts (user_id, class_id, email)
    values (new.id, target_class, lower(new.email))
    on conflict (user_id, class_id) do update set email = excluded.email;

    insert into public.class_memberships (user_id, class_id, role, roll_number)
    values (new.id, target_class, 'student', null)
    on conflict (user_id, class_id, role) do update set is_active = true;
  end if;
  return new;
end;
$$;

revoke all on function public.bootstrap_intel1_user() from public, anon, authenticated;

-- 6. Retroactive cleanup: Deactivate INTEL-1 memberships for any student in INTEL-2 or IBM-1 rosters
do $$
declare
  intel1_id uuid;
  intel2_id uuid;
  ibm1_id uuid;
  conflict_row record;
begin
  -- Keep the conflict check and inserts atomic against concurrent onboarding.
  lock table public.class_memberships in share row exclusive mode;
  select id into intel1_id from public.classes where code = 'INTEL-1';
  select id into intel2_id from public.classes where code = 'INTEL-2';
  select id into ibm1_id from public.classes where code = 'IBM-1';

  -- Existing owners keep their rolls. Report collisions for founder review;
  -- ON CONFLICT(user_id, class_id, role) cannot handle the separate roll index.
  for conflict_row in
    select c.code, r.roll_number, u.id as candidate_id, m.user_id as holder_id
    from (
      select 'INTEL-2' as code, email, roll_number from public.intel2_student_roster
      union all
      select 'IBM-1', email, roll_number from public.ibm1_student_roster
    ) r
    join public.classes c on c.code = r.code
    join auth.users u on lower(u.email) = r.email
    join public.class_memberships m on m.class_id = c.id
      and m.role = 'student' and m.is_active and m.roll_number = r.roll_number
      and m.user_id <> u.id
    where u.email_confirmed_at is not null
      and not exists (select 1 from public.classboard_founders f where f.user_id = u.id)
  loop
    raise warning 'Roster assignment skipped: section %, roll %, candidate %, existing holder %. Founder review required.',
      conflict_row.code, conflict_row.roll_number, conflict_row.candidate_id, conflict_row.holder_id;
  end loop;

  -- A. INTEL-2 Students cleanup
  if intel1_id is not null and intel2_id is not null then
    -- Deactivate INTEL-1 memberships for INTEL-2 students
    update public.class_memberships
    set is_active = false
    where class_id = intel1_id
      and role = 'student'
      and user_id in (
        select u.id from auth.users u
        join public.intel2_student_roster r on r.email = lower(u.email)
        where not exists (select 1 from public.classboard_founders f where f.user_id = u.id)
      );

    -- Activate or assign in INTEL-2
    insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
    select u.id, intel2_id, 'student'::public.class_role, r.roll_number, true
    from auth.users u
    join public.intel2_student_roster r on r.email = lower(u.email)
    where u.email_confirmed_at is not null
      and not exists (select 1 from public.classboard_founders f where f.user_id = u.id)
      and not exists (
        select 1 from public.class_memberships existing
        where existing.class_id = intel2_id and existing.role = 'student'
          and existing.is_active and existing.roll_number = r.roll_number
          and existing.user_id <> u.id
      )
    on conflict (user_id, class_id, role) do update
    set roll_number = excluded.roll_number, is_active = true;

    -- Ensure contact in INTEL-2
    insert into public.class_member_contacts (user_id, class_id, email)
    select u.id, intel2_id, lower(u.email)
    from auth.users u
    join public.intel2_student_roster r on r.email = lower(u.email)
    where u.email_confirmed_at is not null
    on conflict (user_id, class_id) do update set email = excluded.email;
  end if;

  -- B. IBM-1 Students cleanup
  if intel1_id is not null and ibm1_id is not null then
    -- Deactivate INTEL-1 memberships for IBM-1 students
    update public.class_memberships
    set is_active = false
    where class_id = intel1_id
      and role = 'student'
      and user_id in (
        select u.id from auth.users u
        join public.ibm1_student_roster r on r.email = lower(u.email)
        where not exists (select 1 from public.classboard_founders f where f.user_id = u.id)
      );

    -- Activate or assign in IBM-1
    insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
    select u.id, ibm1_id, 'student'::public.class_role, r.roll_number, true
    from auth.users u
    join public.ibm1_student_roster r on r.email = lower(u.email)
    where u.email_confirmed_at is not null
      and not exists (select 1 from public.classboard_founders f where f.user_id = u.id)
      and not exists (
        select 1 from public.class_memberships existing
        where existing.class_id = ibm1_id and existing.role = 'student'
          and existing.is_active and existing.roll_number = r.roll_number
          and existing.user_id <> u.id
      )
    on conflict (user_id, class_id, role) do update
    set roll_number = excluded.roll_number, is_active = true;

    -- Ensure contact in IBM-1
    insert into public.class_member_contacts (user_id, class_id, email)
    select u.id, ibm1_id, lower(u.email)
    from auth.users u
    join public.ibm1_student_roster r on r.email = lower(u.email)
    where u.email_confirmed_at is not null
    on conflict (user_id, class_id) do update set email = excluded.email;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
