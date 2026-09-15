create table password_policy (
 id integer primary key check(id=1), min_length integer not null check(min_length between 8 and 128),
 require_uppercase boolean not null, require_lowercase boolean not null,
 require_digit boolean not null, require_special boolean not null
);
insert into password_policy values(1,12,false,false,false,false);
