export interface Device {
  id: string;
  name: string;
  type: string;
  online: boolean;
  status: DeviceStatus[];
  buttons?: number;
}

export interface DeviceStatus {
  code: string;
  value: boolean | string | number;
}

export interface DeviceCommand {
  commands: {
    code: string;
    value: boolean | string | number;
  }[];
}

export interface DeviceLog {
  eventId: string;
  deviceId: string;
  code: string;
  value: string;
  eventTime: number;
}