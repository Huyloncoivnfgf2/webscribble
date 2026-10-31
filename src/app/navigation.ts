export type ViewKey = 'home' | 'recent' | 'documents' | 'whiteboard' | 'split' | 'settings'

export type ModeKey = 'document' | 'split' | 'whiteboard'

export const VIEW_TITLES: Record<ViewKey, string> = {
  home: 'Trang chủ',
  recent: 'Tài liệu gần đây',
  documents: 'Tài liệu của tôi',
  whiteboard: 'Bảng trắng',
  split: 'Chế độ Split',
  settings: 'Cài đặt',
}
