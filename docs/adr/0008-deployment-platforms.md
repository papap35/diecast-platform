# ADR 0008：部署在 Vercel、Railway、Neon、Upstash

- 狀態：採用

## 背景

作品集專案需要長期公開、維運成本低，又要能展示接近正式環境的部署方式：容器化的 API、託管資料庫、CI/CD。

## 決策

- **Vercel**：前台與後台。Next.js 原生支援，預覽環境與 CDN 免設定。
- **Railway**：API。以 Dockerfile 建置（多階段、只含正式依賴、非 root 執行），部署前自動執行資料庫遷移，健康檢查失敗不會切換流量。
- **Neon**：PostgreSQL。免費方案足夠，支援連線池與時間點還原。
- **Upstash**：Redis。免費方案足夠，支援 TLS。

## 考慮過的替代方案

- **全部放在一台 VPS（Docker Compose）**：成本固定，但要自己處理 TLS、備份、更新與監控。
- **AWS（ECS、RDS、ElastiCache）**：最接近大型正式環境，但對作品集來說成本與設定負擔都偏高。

## 影響

- API 是標準的 Docker 映像，日後要搬到其他平台（Fly.io、Cloud Run、ECS）不需要改程式。
- 各服務的免費方案有用量限制，流量變大時需要升級方案；擴展時的注意事項見[部署指南](../deployment.md#擴展與注意事項)。
