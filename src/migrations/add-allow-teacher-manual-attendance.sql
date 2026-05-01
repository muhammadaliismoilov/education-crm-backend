-- Migration: branches jadvaliga allowTeacherManualAttendance maydonini qo'shish
-- Yaratilgan: 2026-05-01
-- Loyiha: education-crm-backend
-- ⚠️  Bu migration faqat production muhitida (NODE_ENV=production) zarur.
--    Development'da synchronize:true avtomatik qo'shadi.

-- Agar maydon allaqachon mavjud bo'lsa xatolik bermaydi (IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches'
      AND column_name = 'allowTeacherManualAttendance'
  ) THEN
    ALTER TABLE branches
      ADD COLUMN "allowTeacherManualAttendance" boolean NOT NULL DEFAULT false;

    RAISE NOTICE 'allowTeacherManualAttendance ustuni muvaffaqiyatli qo''shildi';
  ELSE
    RAISE NOTICE 'allowTeacherManualAttendance ustuni allaqachon mavjud — o''tkazib yuborildi';
  END IF;
END $$;
