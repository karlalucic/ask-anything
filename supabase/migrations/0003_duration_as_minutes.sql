-- Change duration from duration_preset enum to smallint (minutes)
alter table generations
  alter column duration drop default,
  alter column duration type smallint using (
    case duration::text
      when 'short'  then 5
      when 'medium' then 20
      when 'long'   then 60
      else 20
    end
  );

drop type if exists duration_preset;
