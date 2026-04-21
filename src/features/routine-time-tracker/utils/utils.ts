import type { IsoDateTime } from "@/models/base.model";

export const timeToISO = (timeStr: string, dateStr?: string): IsoDateTime => {
    const date = dateStr || new Date().toISOString().split('T')[0];
    return new Date(`${date}T${timeStr}:00`).toISOString() as IsoDateTime;
};

export const isoToTime = (isoStr: string): string => {
    const date = new Date(isoStr);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const isoToMinutes = (isoStr: string) => {
    const date = new Date(isoStr);
    return date.getHours() * 60 + date.getMinutes();
};

export const isTouchEvent = (e: React.MouseEvent | React.TouchEvent): e is React.TouchEvent => {
    return 'touches' in e;
};