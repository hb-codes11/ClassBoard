-- 036_sync_ibm1_roster_from_excel.sql
-- Sync official IBM-1 (Advanced AI - A) student roster with the Nasscom attendance sheet.
-- Makes IBM-1 work identically to INTEL: students select their own batch and roll number on login.
begin;

-- 1. Re-populate public.ibm1_student_roster table with official Nasscom Excel list
truncate table public.ibm1_student_roster;

insert into public.ibm1_student_roster (roll_number, student_name, email) values
  (1, 'SIYA AGRAWAL', 'en25cs3090211@medicaps.ac.in'),
  (2, 'AKANSH JADAM', 'en25cs3090013@medicaps.ac.in'),
  (3, 'YUVRAJ SINGH SAKTAWAT', 'en25cs3090257@medicaps.ac.in'),
  (4, 'SWASTIK TARE', 'en25cs3090227@medicaps.ac.in'),
  (5, 'SAMAR MODAK', 'en25cs3090193@medicaps.ac.in'),
  (6, 'AASHIKA DHAKAD', 'en25cs3090005@medicaps.ac.in'),
  (7, 'KIRTI PATIDAR', 'en25cs3090097@medicaps.ac.in'),
  (8, 'PARTH SHARMA', 'en25cs3090145@medicaps.ac.in'),
  (9, 'NAIVEDHYA AGRAWAL', 'en25cs3090125@medicaps.ac.in'),
  (10, 'PRINCE GUPTA', 'en25cs3090160@medicaps.ac.in'),
  (11, 'MOHAMMAD ZAID SHAIKH', 'en25cs3090118@medicaps.ac.in'),
  (12, 'SANVI SAKLECHA', 'en25cs3090199@medicaps.ac.in'),
  (13, 'AARUSH RIMZA', 'en25cs3090004@medicaps.ac.in'),
  (14, 'AKSHIT SINGH', 'en25cs3090017@medicaps.ac.in'),
  (15, 'LAVISHA KHATRI', 'en25cs3090107@medicaps.ac.in'),
  (16, 'SHUBHAM CHOUDHARY', 'en25cs3090209@medicaps.ac.in'),
  (17, 'AMAAN KHAN', 'en25cs3090019@medicaps.ac.in'),
  (18, 'PRAKHAR JAIN', 'en25cs3090153@medicaps.ac.in'),
  (19, 'OJAS SHRIVASTAVA', 'en25cs3090138@medicaps.ac.in'),
  (20, 'LUCKY CHOUHAN', 'en25cs3090108@medicaps.ac.in'),
  (21, 'KUSHAL GOYAL', 'en25cs3090105@medicaps.ac.in'),
  (22, 'SHUKH VANSH BHATIYA', 'en25cs3090210@medicaps.ac.in'),
  (23, 'LABDHI JAIN', 'en25cs3090106@medicaps.ac.in'),
  (24, 'IBRAHIM', 'en25cs3090081@medicaps.ac.in'),
  (25, 'PRAKALP JAIN', 'en25cs3090152@medicaps.ac.in'),
  (26, 'VAISHNAVI SAWNER', 'en25cs3090236@medicaps.ac.in'),
  (27, 'Yuvraj singh Rajput', 'en25cs3090256@medicaps.ac.in'),
  (28, 'HANSRAJ CHOUHAN', 'en25cs3090072@medicaps.ac.in'),
  (29, 'AKRITI JAIN', 'en25cs3090014@medicaps.ac.in'),
  (30, 'ARYAN PARASHAR', 'en25cs3090037@medicaps.ac.in'),
  (31, 'KRITI PUNJABI', 'en25cs3090101@medicaps.ac.in'),
  (32, 'DEEPAK KUSHWAHA', 'en25cs3090054@medicaps.ac.in'),
  (33, 'ARGHO BISWAS', 'en25cs3090031@medicaps.ac.in'),
  (34, 'SOUMY MAHAJAN', 'en25cs3090213@medicaps.ac.in'),
  (35, 'VRADHI BHATIYA', 'en25cs3090248@medicaps.ac.in'),
  (36, 'HITANSHU JAISWAL', 'en25cs3090080@medicaps.ac.in'),
  (37, 'RAJ SENDHAV', 'en25cs3090174@medicaps.ac.in'),
  (38, 'ATHARVA KALE', 'en25cs3090044@medicaps.ac.in'),
  (39, 'LAVISHA KHATRI', 'en25cs3090087@medicaps.ac.in'),
  (40, 'SAKSHAM JAIN', 'en25cs3090190@medicaps.ac.in'),
  (41, 'ABHISHEK MEWADA', 'en25cs3090007@medicaps.ac.in'),
  (42, 'TANISHKA JYOTISHI', 'en25cs3090230@medicaps.ac.in'),
  (43, 'MOIZ EZZI BANKWALA', 'en25cs3090123@medicaps.ac.in'),
  (44, 'YUGANT PATIDAR', 'en25cs3090254@medicaps.ac.in'),
  (45, 'PRANAV KOLAMBE', 'en25cs3090154@medicaps.ac.in'),
  (46, 'SUYOG JADHAV', 'en25cs3090224@medicaps.ac.in'),
  (47, 'ABI ALI', 'en25cs3090009@medicaps.ac.in'),
  (48, 'PRIYANSHI KUCHERIYA', 'en25cs3090165@medicaps.ac.in'),
  (49, 'KHUSHI MAHESHWARI', 'en25cs3090095@medicaps.ac.in'),
  (50, 'REHAN SHAIKH', 'en25cs3090181@medicaps.ac.in'),
  (51, 'ARYAN KHARE', 'en25cs3090036@medicaps.ac.in'),
  (52, 'AMOGH KARALE', 'en25cs3090021@medicaps.ac.in'),
  (53, 'BHUMIKA YADAV', 'en25cs3090052@medicaps.ac.in'),
  (54, 'VARUN CHANDSARKAR', 'en25cs3090240@medicaps.ac.in'),
  (55, 'NEHAL CHHIPA', 'en25cs3090130@medicaps.ac.in'),
  (56, 'ISHA PAYASI', 'en25cs3090082@medicaps.ac.in'),
  (57, 'BHANUPRIYA YADAV', 'en25cs3090050@medicaps.ac.in'),
  (58, 'VANSHIKA NAGPAL', 'en25cs3090239@medicaps.ac.in'),
  (59, 'STUTI DWIVEDI', 'en25cs3090219@medicaps.ac.in'),
  (60, 'PRIYANSHI SAH', 'en25cs3090167@medicaps.ac.in'),
  (61, 'RAGHAV MAHESHWARI', 'en25cs3090172@medicaps.ac.in'),
  (62, 'MOHD ALI KHAN', 'en25cs3090120@medicaps.ac.in'),
  (63, 'EAKA NAGAR', 'en25cs3090064@medicaps.ac.in'),
  (64, 'ARYAN UPADHYAY', 'en25cs3090039@medicaps.ac.in'),
  (65, 'PIYUSH MANDLOI', 'en25cs3090150@medicaps.ac.in'),
  (66, 'ISHA BADHE', 'en25cs3090268@medicaps.ac.in'),
  (67, 'HIMANSHU PATIL', 'en25cs3090277@medicaps.ac.in');

-- 2. Update bootstrap_ibm1_user:
-- Do NOT auto-lock roll_number; set roll_number = null so IBM-1 students
-- select their batch and roll number on first login, exactly like INTEL sections.
create or replace function public.bootstrap_ibm1_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  section_id uuid;
  roster_row public.ibm1_student_roster%rowtype;
begin
  if new.email_confirmed_at is null or new.email is null then
    return new;
  end if;
  select * into roster_row from public.ibm1_student_roster where email = lower(new.email);
  if not found then return new; end if;
  select id into section_id from public.classes where code = 'IBM-1' and is_active;
  if section_id is null then return new; end if;

  insert into public.profiles (user_id, display_name)
  values (new.id, roster_row.student_name)
  on conflict (user_id) do update set display_name = excluded.display_name
  where public.profiles.display_name = '' or lower(public.profiles.display_name) = split_part(lower(new.email), '@', 1);

  insert into public.class_member_contacts (user_id, class_id, email)
  values (new.id, section_id, lower(new.email))
  on conflict (user_id, class_id) do nothing;

  -- Insert with roll_number NULL so student is prompted on login to choose batch & roll number
  insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
  values (new.id, section_id, 'student', null, true)
  on conflict (user_id, class_id, role) do update set is_active = true;

  return new;
end;
$$;

revoke all on function public.bootstrap_ibm1_user() from public, anon, authenticated;

-- 3. Reset existing IBM-1 student roll numbers to NULL so they get the setup dialog
-- on login to choose their batch and roll number (matches INTEL flow).
do $$
declare
  section_id uuid;
begin
  select id into section_id from public.classes where code = 'IBM-1' and is_active;
  if section_id is null then return; end if;

  -- Sync display names
  update public.profiles p
  set display_name = r.student_name
  from auth.users u
  join public.ibm1_student_roster r on r.email = lower(u.email)
  where p.user_id = u.id;

  -- Reset roll numbers for IBM-1 students so they choose batch & roll on login
  update public.class_memberships m
  set roll_number = null
  where m.class_id = section_id
    and m.role = 'student'
    and m.user_id not in (select user_id from public.classboard_founders);
end; $$;

notify pgrst, 'reload schema';

commit;
