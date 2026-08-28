-- ESATIC SmartVote — ajoute password_version pour invalider les tokens
-- émis avant un changement de mot de passe.

alter table students
    add column if not exists password_version integer not null default 1;

create index if not exists idx_students_pwd_version on students(id, password_version);
