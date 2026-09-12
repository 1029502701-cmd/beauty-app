-- reports_tier3 增加 face_photo_key：记录生成专属报告时用户上传的照片 R2 key
ALTER TABLE reports_tier3 ADD COLUMN face_photo_key TEXT;
