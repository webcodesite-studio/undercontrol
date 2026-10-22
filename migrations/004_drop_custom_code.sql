-- Migracja 004 — usuwa kolumnę po funkcji kodów konfiguracji (usuniętej z projektu).
-- Potrzebna tylko, jeśli uruchomiłeś wcześniejszą wersję migracji 003. Bezpieczna: nic nie robi, gdy kolumny nie ma.
alter table sales drop column if exists custom_code;
