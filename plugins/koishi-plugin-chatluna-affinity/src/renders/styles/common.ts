/**
 * 公共 CSS 样式
 * 提供所有渲染器共用的基础样式定义
 */

export const COMMON_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap');
  @import url('https://fonts.googleapis.com/css?family=Noto+Color+Emoji');
  
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: "Noto Sans SC", "Noto Color Emoji", "Segoe UI", "Microsoft YaHei", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
    background: #f0f2f5;
    color: #1f2937;
  }

  .container {
    padding: 32px;
    width: 600px;
    background: #f0f2f5;
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-feature-settings: "palt";
  }

  .header {
    margin-bottom: 8px;
    padding: 0 8px;
  }

  h1 {
    font-size: 24px;
    margin: 0;
    font-weight: 700;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  h2 {
    font-size: 16px;
    font-weight: 500;
    color: #6b7280;
    margin-top: 4px;
  }

  .card {
    background: #ffffff;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #e5e7eb;
    flex-shrink: 0;
  }
  
  .avatar-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #f3f4f6;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
    font-weight: 600;
    font-size: 20px;
    border: 2px solid #e5e7eb;
  }

  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .name {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .sub-text {
    font-size: 12px;
    color: #6b7280;
  }

  .badge {
    font-size: 12px;
    padding: 2px 8px;
    background: #e0e7ff;
    color: #4f46e5;
    border-radius: 999px;
    font-weight: 500;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  
  .badge-red {
    background: #fee2e2;
    color: #ef4444;
  }

  .badge-orange {
    background: #ffedd5;
    color: #f97316;
  }
  
  .badge-gray {
    background: #f3f4f6;
    color: #6b7280;
  }

  .value-container {
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    flex-shrink: 0;
  }

  .value-primary {
    font-size: 18px;
    font-weight: 700;
    color: #ec4899;
    font-feature-settings: "tnum";
  }
  
  .value-secondary {
    font-size: 14px;
    font-weight: 600;
    color: #4b5563;
  }

  .label-small {
    font-size: 12px;
    color: #6b7280;
  }

  .stat-label {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
  }
`
