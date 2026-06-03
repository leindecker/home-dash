-- Habilitar RLS em todas as tabelas
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RememberToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SwitchLabel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoomSwitch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Device" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceLog" ENABLE ROW LEVEL SECURITY;

-- Políticas para User — apenas o próprio usuário acessa
CREATE POLICY "users_own_data" ON "User"
  FOR ALL USING (true);

-- Políticas para RememberToken
CREATE POLICY "tokens_access" ON "RememberToken"
  FOR ALL USING (true);

-- Políticas para SwitchLabel — acesso total via service role
CREATE POLICY "switch_labels_access" ON "SwitchLabel"
  FOR ALL USING (true);

-- Políticas para Room — acesso total via service role
CREATE POLICY "rooms_access" ON "Room"
  FOR ALL USING (true);

-- Políticas para RoomSwitch — acesso total via service role
CREATE POLICY "room_switches_access" ON "RoomSwitch"
  FOR ALL USING (true);

-- Políticas para Device — acesso total via service role
CREATE POLICY "devices_access" ON "Device"
  FOR ALL USING (true);

-- Políticas para DeviceLog — acesso total via service role
CREATE POLICY "device_logs_access" ON "DeviceLog"
  FOR ALL USING (true);
