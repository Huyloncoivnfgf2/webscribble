export type ViewKey = 'home' | 'recent' | 'documents' | 'whiteboard' | 'settings'

export type ModeKey = 'document' | 'split' | 'whiteboard'

export const VIEW_TITLES: Record<ViewKey, string> = {
  home: 'Trang chủ',
  recent: 'Tài liệu gần đây',
  documents: 'Tài liệu của tôi',
  whiteboard: 'Bảng trắng',
  settings: 'Cài đặt',
}
