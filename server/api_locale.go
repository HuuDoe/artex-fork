package server

import (
	"net/http"
	"strings"
)

// apiLocale selects a response language from the canonical locale cookie first,
// then Accept-Language. API clients without a locale retain the historical Chinese.
func apiLocale(r *http.Request) string {
	if c, err := r.Cookie("locale"); err == nil {
		if locale := normalizeAPILocale(c.Value); locale != "" {
			return locale
		}
	}
	for _, item := range strings.Split(r.Header.Get("Accept-Language"), ",") {
		language := strings.TrimSpace(strings.SplitN(item, ";", 2)[0])
		if locale := normalizeAPILocale(language); locale != "" {
			return locale
		}
	}
	return "zh-CN"
}

func normalizeAPILocale(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "zh-cn", "zh":
		return "zh-CN"
	case "en-us", "en":
		return "en-US"
	case "vi-vn", "vi":
		return "vi-VN"
	default:
		return ""
	}
}

var apiErrorTranslations = map[string][3]string{
	"未授权":             {"未授权", "Unauthorized", "Chưa được xác thực"},
	"token 无效或已过期":    {"token 无效或已过期", "Invalid or expired token", "token không hợp lệ hoặc đã hết hạn"},
	"非法路径":            {"非法路径", "Invalid path", "Đường dẫn không hợp lệ"},
	"路径不存在":           {"路径不存在", "Path not found", "Không tìm thấy đường dẫn"},
	"文件不存在":           {"文件不存在", "File not found", "Không tìm thấy file"},
	"不是目录":            {"不是目录", "Not a directory", "Không phải thư mục"},
	"目标是目录":           {"目标是目录", "Target is a directory", "Đích là thư mục"},
	"目标目录不存在":         {"目标目录不存在", "Target directory not found", "Không tìm thấy thư mục đích"},
	"不能删除工作区根目录":      {"不能删除工作区根目录", "Cannot delete the workspace root", "Không thể xóa thư mục gốc workspace"},
	"密码不能为空":          {"密码不能为空", "Password is required", "Vui lòng nhập password"},
	"密码已设置":           {"密码已设置", "Password is already set", "Password đã được thiết lập"},
	"请求格式错误":          {"请求格式错误", "Invalid request format", "Định dạng request không hợp lệ"},
	"新密码不能为空":         {"新密码不能为空", "New password is required", "Vui lòng nhập password mới"},
	"用户名或密码错误":        {"用户名或密码错误", "Incorrect username or password", "Tên người dùng hoặc password không chính xác"},
	"当前密码错误":          {"当前密码错误", "Incorrect current password", "Current password không chính xác"},
	"数据库暂不可用":         {"数据库暂不可用", "Database temporarily unavailable", "Database tạm thời không khả dụng"},
	"引用 ID 无效，请重新选择":  {"引用 ID 无效，请重新选择", "Invalid reference ID; please select it again", "ID tham chiếu không hợp lệ; vui lòng chọn lại"},
	"每条消息最多引用 10 条记录": {"每条消息最多引用 10 条记录", "A message can reference at most 10 records", "Mỗi message chỉ có thể tham chiếu tối đa 10 bản ghi"},
	"引用数据暂不可用":        {"引用数据暂不可用", "Reference data is temporarily unavailable", "Dữ liệu tham chiếu tạm thời không khả dụng"},
	"引用内容过大，请减少引用记录后重试": {"引用内容过大，请减少引用记录后重试", "Referenced content is too large; reduce the number of records and try again", "Nội dung tham chiếu quá lớn; hãy giảm số bản ghi và thử lại"},
	"请求正文过大":               {"请求正文过大", "Request body is too large", "Request body quá lớn"},
	"name required":        {"name required", "Name is required", "Vui lòng nhập name"},
	"invalid id":           {"invalid id", "Invalid ID", "ID không hợp lệ"},
	"company not found":    {"company not found", "Company not found", "Không tìm thấy company"},
	"finding not found":    {"finding not found", "Finding not found", "Không tìm thấy finding"},
	"database unavailable": {"database unavailable", "Database unavailable", "Database không khả dụng"},
}

func localizedErr(w http.ResponseWriter, r *http.Request, code int, msg string) {
	translations, ok := apiErrorTranslations[msg]
	if ok {
		switch apiLocale(r) {
		case "en-US":
			msg = translations[1]
		case "vi-VN":
			msg = translations[2]
		default:
			msg = translations[0]
		}
	}
	writeErr(w, code, msg)
}
