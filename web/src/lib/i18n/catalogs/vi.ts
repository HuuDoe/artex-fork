/**
 * Vietnamese catalog.
 *
 * Must define every key in `./zh-cn` (the source locale).
 *
 * Quy ước dịch: thuật ngữ kỹ thuật và tên riêng giữ nguyên tiếng Anh
 * (Agent, worker, planner, LLM, endpoint, proxy, traffic, tool, task,
 * asset, finding, Docker, v.v.); chỉ dịch văn xuôi và thuật ngữ chung.
 * Dịch theo đúng nghĩa gốc tiếng Trung trong catalog nguồn.
 */

import type { Dictionary } from "../dictionary";

export const vi: Dictionary = {
  // --- app shell / navigation ---
  "nav.dashboard": "Dashboard",
  "nav.function": "Chức năng",
  "nav.system": "Hệ thống",
  "nav.llm": "LLM",
  "nav.settings": "Cấu hình hệ thống",
  "nav.agents": "Quản lý Agent",
  "nav.mcp": "MCP",
  "nav.tools": "Kho tool",
  "nav.skills": "Kho skill",
  "nav.intercept": "Phê duyệt intercept",
  "nav.notify": "Kênh thông báo",
  "nav.logs": "Log hệ thống",
  "nav.tasks": "Task",
  "nav.findings": "Phát hiện",
  "nav.assets": "Asset",
  "nav.traffic": "Ghi lại traffic",
  "nav.chat": "Chat",
  "nav.workspace": "Workspace",
  "nav.commands": "Bộ command",
  "nav.sync": "Đồng bộ asset",
  "nav.llmRecords": "Lịch sử LLM",
  "nav.collapse": "Thu gọn sidebar",
  "nav.expand": "Mở rộng sidebar",

  // --- generic actions ---
  "action.save": "Lưu",
  "action.cancel": "Hủy",
  "action.confirm": "Xác nhận",
  "action.delete": "Xóa",
  "action.edit": "Sửa",
  "action.add": "Thêm",
  "action.create": "Tạo",
  "action.close": "Đóng",
  "action.search": "Tìm kiếm",
  "action.reset": "Đặt lại",
  "action.refresh": "Làm mới",
  "action.retry": "Thử lại",
  "action.copy": "Sao chép",
  "action.copied": "Đã sao chép",
  "action.view": "Xem",
  "action.detail": "Chi tiết",
  "action.back": "Quay lại",
  "action.next": "Tiếp theo",
  "action.prev": "Trước",
  "action.submit": "Gửi",
  "action.test": "Kiểm thử",
  "action.loading": "Đang tải…",
  "action.noData": "Chưa có dữ liệu",
  "action.all": "Tất cả",
  "action.more": "Thêm",
  "action.expand": "Mở rộng",
  "action.collapse": "Thu gọn",
  "action.select": "Chọn",
  "action.clear": "Xóa trống",
  "action.apply": "Áp dụng",
  "action.rollback": "Rollback",

  // --- generic state ---
  "state.enabled": "Đã bật",
  "state.disabled": "Đã tắt",
  "state.loading": "Đang tải",
  "state.success": "Thành công",
  "state.failed": "Thất bại",
  "state.unknown": "Không rõ",
  "state.running": "Đang chạy",
  "state.stopped": "Đã dừng",
  "state.pending": "Đang chờ",
  "state.completed": "Đã hoàn tất",
  "state.queued": "Trong hàng đợi",

  // --- language ---
  "settings.language.title": "Ngôn ngữ giao diện",
  "settings.language.description":
    "Chọn ngôn ngữ hiển thị cho giao diện. Lựa chọn được lưu trong trình duyệt này, không đồng bộ theo tài khoản.",
  "settings.language.changed": "Đã đổi ngôn ngữ giao diện",

  // --- system settings page ---
  "settings.page.title": "Cấu hình hệ thống",
  "settings.page.subtitle": "Công tắc bật/tắt toàn cục khi chạy",
  "settings.update.title": "Phiên bản & Cập nhật",
  "settings.update.description":
    "Kiểm tra và cài phiên bản mới từ GitHub. Việc cập nhật sẽ khởi động lại chương trình và làm gián đoạn các task đang chạy.",
  "settings.trafficCapture.title": "Ghi lại traffic",
  "settings.trafficCapture.description":
    "Khi bật, toàn bộ HTTP traffic của Agent được ghi lại đầy đủ qua recording proxy, đồng thời các tool traffic_search / traffic_get và cấu hình proxy được tiêm vào Agent (prompt có kèm hướng dẫn về proxy).",
  "settings.trafficCapture.descriptionOff":
    "Khi tắt (mặc định) sẽ không ghi lại bất kỳ traffic nào: Agent không nhận được cấu hình proxy hay các tool traffic, và prompt cũng không nhắc tới proxy. Thay đổi có hiệu lực ngay lập tức sau khi dựng lại Agent.",
  "settings.trafficCapture.label": "Ghi lại toàn bộ HTTP traffic của Agent",
  "settings.agentTrafficBinding.title": "Tự động gắn traffic cho Agent",
  "settings.agentTrafficBinding.label": "Tự động gắn task mới vào recording proxy",
  "settings.proxy.title": "Proxy toàn cục",
  "settings.proxy.description":
    "Proxy dùng khi truy cập GitHub, dịch vụ LLM và các địa chỉ bên ngoài khác, ví dụ http://127.0.0.1:7890. Để trống nghĩa là không dùng.",
  "settings.proxy.placeholder": "http://127.0.0.1:7890",
  "settings.constraints.title": "Tiêm ràng buộc thao tác",
  "settings.constraints.planner": "Tiêm ràng buộc vào planner",
  "settings.constraints.worker": "Tiêm ràng buộc vào worker",
  "settings.experimental.title": "Tính năng thử nghiệm",
  "settings.experimental.noa": "Nén context noa",
  "settings.websearch.title": "Tìm kiếm web",
  "settings.websearch.enable": "Bật tool tìm kiếm web",
  "settings.websearch.backend": "Search backend",
  "settings.websearch.proxy": "Proxy thoát cho tìm kiếm",
  "settings.websearch.workers": "Số Work Agent chạy song song",
  "settings.workers.description":
    "Số work agent chạy đồng thời trong một task. Có hiệu lực với các task khởi động sau đó.",
  "settings.python.title": "Script tùy chỉnh · Python interpreter",
  "settings.python.description":
    "Python interpreter dùng để chạy script tùy chỉnh. Để trống sẽ dùng python3 mặc định của hệ thống.",
  "settings.python.detect": "Tự động phát hiện",
  "settings.sendKey.title": "Phím gửi trong ô nhập",
  "settings.sendKey.description": "Tùy chọn này chỉ nằm trong trình duyệt này, không đồng bộ theo tài khoản.",

  // --- common ---
  "common.confirmDelete": "Bạn có chắc muốn xóa? Hành động này không thể hoàn tác.",
  "common.loadFailed": "Tải thất bại",
  "common.saveFailed": "Lưu thất bại: {message}",
  "common.name": "Tên",
  "common.type": "Loại",
  "common.status": "Trạng thái",
  "common.actions": "Thao tác",
  "common.createdAt": "Thời gian tạo",
  "common.updatedAt": "Thời gian cập nhật",
  "common.description": "Mô tả",
  "common.optional": "Không bắt buộc",
  "common.required": "Bắt buộc",
  "common.yes": "Có",
  "common.no": "Không",
  "common.total": "Tổng cộng {count}",
};
