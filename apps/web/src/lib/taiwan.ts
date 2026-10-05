export const TW_CITIES = [
  '臺北市',
  '新北市',
  '桃園市',
  '臺中市',
  '臺南市',
  '高雄市',
  '基隆市',
  '新竹市',
  '嘉義市',
  '新竹縣',
  '苗栗縣',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義縣',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '臺東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
] as const;

export interface DemoStore {
  id: string;
  name: string;
  address: string;
}

/**
 * 示範用超商門市（虛構資料）。
 * 正式環境改用綠界「超商電子地圖」讓消費者自行選店，回傳門市代號與地址。
 */
export const DEMO_STORES: Record<
  'CVS_711' | 'CVS_FAMILY' | 'CVS_HILIFE' | 'CVS_OKMART',
  DemoStore[]
> = {
  CVS_711: [
    { id: '131386', name: '7-ELEVEN 建國門市', address: '臺北市中山區建國北路一段 100 號' },
    { id: '172925', name: '7-ELEVEN 逢甲門市', address: '臺中市西屯區福星路 300 號' },
    { id: '200459', name: '7-ELEVEN 成大門市', address: '臺南市東區大學路 18 號' },
  ],
  CVS_FAMILY: [
    { id: '004712', name: '全家 民生店', address: '臺北市松山區民生東路四段 55 號' },
    { id: '011385', name: '全家 板橋文化店', address: '新北市板橋區文化路一段 188 號' },
    { id: '018806', name: '全家 高雄巨蛋店', address: '高雄市左營區博愛二路 777 號' },
  ],
  CVS_HILIFE: [
    { id: '2471', name: '萊爾富 桃園中正店', address: '桃園市桃園區中正路 1071 號' },
    { id: '3305', name: '萊爾富 新竹光復店', address: '新竹市東區光復路二段 101 號' },
  ],
  CVS_OKMART: [
    { id: '1652', name: 'OK 超商 基隆仁愛店', address: '基隆市仁愛區愛三路 66 號' },
    { id: '1873', name: 'OK 超商 花蓮中山店', address: '花蓮縣花蓮市中山路 200 號' },
  ],
};
