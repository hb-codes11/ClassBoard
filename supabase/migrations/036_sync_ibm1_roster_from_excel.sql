-- 036_sync_ibm1_roster_from_excel.sql
-- Sync official IBM-1 (Advanced AI - A) student roster with the Nasscom attendance sheet.
-- Roll 1 to 32 -> Batch A1 (includes PRAKALP JAIN at Roll 25).
-- Roll 33 to 67 -> Batch A2.
begin;

-- 1. Re-populate public.ibm1_student_roster table
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

-- 2. Update existing active IBM-1 memberships and profiles
do $$
declare
  section_id uuid;
begin
  select id into section_id from public.classes where code = 'IBM-1' and is_active;
  if section_id is null then return; end if;

  -- Update display names from official roster
  update public.profiles p
  set display_name = r.student_name
  from auth.users u
  join public.ibm1_student_roster r on r.email = lower(u.email)
  where p.user_id = u.id;

  -- First clear existing roll numbers to prevent unique constraint collision on swap
  update public.class_memberships m
  set roll_number = null
  from auth.users u
  join public.ibm1_student_roster r on r.email = lower(u.email)
  where m.user_id = u.id
    and m.class_id = section_id
    and m.role = 'student';

  -- Ensure roll numbers in class_memberships match the official Excel roster
  update public.class_memberships m
  set roll_number = r.roll_number
  from auth.users u
  join public.ibm1_student_roster r on r.email = lower(u.email)
  where m.user_id = u.id
    and m.class_id = section_id
    and m.role = 'student';
end; $$;

commit;
