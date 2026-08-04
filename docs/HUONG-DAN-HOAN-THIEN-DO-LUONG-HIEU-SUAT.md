# Hướng dẫn hoàn thiện hệ thống đo lường hiệu suất Dorae Coffee

Tài liệu này mô tả toàn bộ công việc còn lại để website
`https://doraecoffee.io.vn/` có thể thu thập, kiểm tra và báo cáo các KPI trong
kế hoạch tháng 6–8/2026.

## 1. Tình trạng hiện tại

### 1.1. Những phần đã hoàn thành

- Website đã có lớp tracking và `dataLayer`.
- Website đã phát sinh các sự kiện:
  - `view_item_list`: xem danh mục sản phẩm;
  - `view_item`: xem chi tiết sản phẩm;
  - `add_to_cart`: thêm sản phẩm vào giỏ;
  - `begin_checkout`: bắt đầu thanh toán;
  - `purchase`: API xác nhận tạo đơn hàng thành công;
  - `generate_lead`: gửi biểu mẫu liên hệ thành công;
  - `article_viewed`: xem bài viết;
  - `social_link_clicked`: nhấn liên kết Facebook, Zalo hoặc TikTok.
- Sự kiện `purchase` có mã giao dịch, giá trị đơn hàng, phí vận chuyển và danh
  sách sản phẩm.
- Không đưa tên, số điện thoại, email, địa chỉ, ghi chú đơn hàng hoặc nội dung
  liên hệ vào dữ liệu analytics.
- Consent Mode mặc định là từ chối. Mã Google chỉ được tải sau khi khách đồng ý.
- Sitemap đã có trang chủ, danh mục, sản phẩm và bài viết.
- Có công cụ tạo UTM và công cụ audit KPI trong repository.

### 1.2. Những phần chưa hoàn thành

| Hạng mục | Trạng thái | Lý do |
| --- | --- | --- |
| Tạo GA4 property | Chưa làm | Cần tài khoản Google của chủ website |
| Tạo GTM container | Chưa làm | Cần tài khoản Google và quyền Publish |
| Gắn mã `GTM-...` | Chưa làm | Chưa có Container ID thật |
| Cấu hình tag GA4 trong GTM | Chưa làm | Chưa có GA4 Measurement ID |
| Đánh dấu Key event | Chưa làm | GA4 chưa nhận sự kiện |
| Kiểm thử DebugView | Chưa làm | Google tag chưa hoạt động |
| Xác minh Search Console | Chưa xác nhận | Cần quyền Owner |
| Gửi sitemap cho Google | Chưa xác nhận | Cần quyền Search Console |
| Liên kết GA4 và Search Console | Chưa làm | Cần quyền ở cả hai hệ thống |
| Báo cáo backlink | Chưa có dữ liệu | Cần Search Console hoặc nhà cung cấp backlink |
| Dashboard Looker Studio | Chưa làm | Chưa có nguồn GA4/Search Console |

## 2. Chuẩn bị tài khoản và phân quyền

Nên sử dụng một tài khoản Google do doanh nghiệp quản lý, không dùng tài khoản
cá nhân của đơn vị triển khai làm chủ sở hữu duy nhất.

Cần chuẩn bị:

1. Một tài khoản Google chính của Dorae Coffee.
2. Một tài khoản Google dự phòng có quyền quản trị.
3. Quyền quản lý tên miền/DNS Cloudflare nếu chọn xác minh Search Console bằng DNS.
4. Quyền sửa mã nguồn và deploy Cloudflare Pages cho người gắn Container ID.

Phân quyền tối thiểu:

- GA4: Editor để tạo luồng dữ liệu, liên kết sản phẩm và cấu hình sự kiện.
- Search Console: Verified owner để liên kết với GA4.
- GTM: Publish để phát hành container.
- Looker Studio: Editor đối với báo cáo.

## 3. Bước 1 — Tạo Google Analytics 4

1. Truy cập `https://analytics.google.com/` và đăng nhập bằng tài khoản doanh nghiệp.
2. Chọn **Admin**.
3. Chọn **Create → Account** nếu Dorae Coffee chưa có tài khoản Analytics.
4. Đặt tên tài khoản: `Dorae Coffee`.
5. Chọn **Create Property**.
6. Đặt tên property: `Dorae Coffee - Production`.
7. Chọn múi giờ `Vietnam` và tiền tệ `Vietnamese Dong (VND)`.
8. Trong **Data streams**, chọn **Add stream → Web**.
9. Nhập:
   - Website URL: `https://doraecoffee.io.vn`;
   - Stream name: `Dorae Coffee Website`.
10. Bật **Enhanced measurement**.
11. Chọn **Create stream**.
12. Sao chép Measurement ID dạng `G-XXXXXXXXXX` và lưu trong trình quản lý mật
    khẩu/tài liệu nội bộ.

Kết quả cần có sau bước này:

- Tên GA4 property;
- Property ID dạng số;
- Measurement ID bắt đầu bằng `G-`;
- tài khoản chủ sở hữu và tài khoản dự phòng đều truy cập được.

Hướng dẫn chính thức: <https://support.google.com/analytics/answer/14183469>

## 4. Bước 2 — Tạo Google Tag Manager

GTM là phương án được khuyến nghị cho website này vì mã nguồn đã đẩy các sự kiện
vào `dataLayer`.

1. Truy cập `https://tagmanager.google.com/`.
2. Chọn **Create Account**.
3. Nhập:
   - Account name: `Dorae Coffee`;
   - Country: `Vietnam`;
   - Container name: `doraecoffee.io.vn`;
   - Target platform: `Web`.
4. Chấp nhận điều khoản.
5. Sao chép Container ID dạng `GTM-XXXXXXX`.
6. Thêm tài khoản dự phòng với quyền **Publish**.

Không cần sao chép thủ công hai đoạn mã GTM vào từng trang. Website đã có bộ nạp
GTM có kiểm soát consent; người triển khai chỉ cần điền đúng Container ID.

## 5. Bước 3 — Gắn Container ID vào website

Mở file `assets/js/config.js` và điền:

```js
GTM_CONTAINER_ID: "GTM-XXXXXXX",
GA4_MEASUREMENT_ID: "",
```

Chỉ sử dụng một phương án. Khi đã dùng GTM, để `GA4_MEASUREMENT_ID` trống nhằm
tránh phát sinh hai lượt `page_view` hoặc hai lượt chuyển đổi.

Sau đó chạy:

```powershell
npm run validate
git add assets/js/config.js
git commit -m "Configure Google Tag Manager"
git push origin main
npx wrangler pages deploy . --project-name=doare-coffee --branch=main
```

Kiểm tra mã `GTM-...` không bị gõ sai trước khi deploy.

## 6. Bước 4 — Cấu hình GA4 trong GTM

### 6.1. Tạo Google tag nền

1. Mở GTM container của `doraecoffee.io.vn`.
2. Chọn **Tags → New**.
3. Chọn loại **Google tag**.
4. Nhập Measurement ID `G-XXXXXXXXXX` lấy từ GA4.
5. Chọn trigger **Initialization – All Pages** hoặc **All Pages**.
6. Đặt tên tag: `Google tag - GA4 - Production`.
7. Lưu nhưng chưa Publish.

### 6.2. Tạo trigger cho các sự kiện website

Tạo một trigger **Custom Event** với biểu thức chính quy:

```text
^(view_item_list|view_item|add_to_cart|begin_checkout|purchase|generate_lead|article_viewed|social_link_clicked)$
```

Đặt tên trigger: `CE - Dorae tracked events`.

### 6.3. Tạo GA4 Event tag

1. Chọn **Tags → New → Google Analytics: GA4 Event**.
2. Chọn Google tag vừa tạo.
3. Event name dùng biến tích hợp `{{Event}}`.
4. Chọn trigger `CE - Dorae tracked events`.
5. Với các sự kiện ecommerce, bật gửi dữ liệu ecommerce từ Data Layer nếu giao
   diện GTM hiển thị lựa chọn này.
6. Đặt tên tag: `GA4 Event - Dorae dataLayer events`.
7. Lưu nhưng chưa Publish.

Các tham số cần xuất hiện trong GA4:

| Sự kiện | Tham số cần kiểm tra |
| --- | --- |
| `view_item_list` | `item_list_id`, `item_list_name`, `items` |
| `view_item` | `currency`, `value`, `items` |
| `add_to_cart` | `currency`, `value`, `items` |
| `begin_checkout` | `currency`, `value`, `items` |
| `purchase` | `transaction_id`, `currency`, `value`, `shipping`, `items` |
| `generate_lead` | `lead_source`, `form_location` |
| `article_viewed` | `article_slug`, `article_title`, `published_date` |
| `social_link_clicked` | `platform`, `link_location` |

Nếu GTM không tự truyền các tham số tùy chỉnh, tạo Data Layer Variable tương ứng,
ví dụ `DLV - platform`, rồi thêm biến đó vào Event Parameters của GA4 Event tag.

## 7. Bước 5 — Kiểm thử trước khi Publish GTM

### 7.1. Kiểm tra Consent Mode

Thực hiện hai phiên trình duyệt riêng tư:

1. Phiên A chọn **Từ chối**:
   - không được tải Google tag theo chế độ triển khai hiện tại;
   - không được ghi cookie analytics.
2. Phiên B chọn **Đồng ý**:
   - GTM được tải;
   - sự kiện được gửi sang GA4.

### 7.2. Kiểm tra bằng GTM Preview

1. Trong GTM chọn **Preview**.
2. Nhập `https://doraecoffee.io.vn/`.
3. Chọn **Connect**.
4. Đồng ý đo lường trên banner của website.
5. Thực hiện lần lượt:
   - mở trang chủ;
   - mở danh mục;
   - xem một sản phẩm;
   - thêm vào giỏ;
   - mở checkout;
   - gửi một biểu mẫu liên hệ thử;
   - mở một bài viết;
   - nhấn một liên kết mạng xã hội;
   - tạo một đơn hàng thử có ghi chú rõ `ĐƠN KIỂM THỬ`.
6. Trong Tag Assistant, xác nhận mỗi hành động chỉ phát sinh một sự kiện.

Hướng dẫn chính thức: <https://support.google.com/tagmanager/answer/6107056>

### 7.3. Kiểm tra bằng GA4 DebugView

1. Vào **GA4 → Admin → Data display → DebugView**.
2. Chọn thiết bị đang chạy GTM Preview.
3. Kiểm tra tên và tham số của từng sự kiện.
4. Với `purchase`, xác nhận:
   - `transaction_id` bằng mã đơn trong hệ thống;
   - `value` bằng tổng tiền;
   - `currency` bằng `VND`;
   - không có dữ liệu cá nhân;
   - không xuất hiện hai lần.

Do website dùng Consent Mode, DebugView không nhận sự kiện nếu phiên kiểm thử chưa
đồng ý analytics.

Hướng dẫn chính thức: <https://support.google.com/analytics/answer/7201382>

### 7.4. Publish GTM

Chỉ Publish khi toàn bộ kiểm tra đạt yêu cầu:

1. Chọn **Submit**.
2. Chọn **Publish and Create Version**.
3. Version name: `GA4 tracking - initial production release`.
4. Mô tả danh sách tag, trigger và sự kiện đã kiểm tra.
5. Chọn **Publish**.

Hướng dẫn chính thức: <https://support.google.com/tagmanager/answer/6107163>

## 8. Bước 6 — Cấu hình Key event trong GA4

Chỉ đánh dấu hành động thể hiện giá trị kinh doanh thực sự:

| Sự kiện | Đánh dấu Key event? | Quy tắc đếm |
| --- | --- | --- |
| `purchase` | Có | Mỗi `transaction_id` hợp lệ một lần |
| `generate_lead` | Có | Mỗi lần API xác nhận gửi liên hệ |
| `add_to_cart` | Không | Chỉ là tín hiệu ý định |
| `begin_checkout` | Không | Chưa hoàn tất đơn hàng |
| `page_view` | Không | Không phải chuyển đổi |

`purchase` thường được GA4 đánh dấu mặc định. Vẫn phải kiểm tra lại.

Để đánh dấu `generate_lead`:

1. Vào **GA4 → Admin → Data display → Events**.
2. Tìm `generate_lead` trong Recent events.
3. Chọn biểu tượng ngôi sao để đánh dấu là Key event.
4. Chờ tối đa 24 giờ để xuất hiện đầy đủ trong báo cáo chuẩn.

Việc đánh dấu chỉ có hiệu lực từ thời điểm cấu hình, không áp dụng ngược cho dữ
liệu lịch sử.

Hướng dẫn chính thức: <https://support.google.com/analytics/answer/13128484>

## 9. Bước 7 — Hoàn thiện Google Search Console

### 9.1. Xác minh quyền sở hữu

1. Truy cập `https://search.google.com/search-console/`.
2. Thêm Domain property: `doraecoffee.io.vn`.
3. Sao chép bản ghi TXT do Google cung cấp.
4. Thêm TXT vào DNS Cloudflare.
5. Quay lại Search Console và chọn **Verify**.

Xác minh Domain bằng DNS được ưu tiên vì bao phủ cả `https`, `http`, tên miền gốc
và các subdomain. Nếu không có quyền DNS, có thể dùng URL-prefix property và file
HTML xác minh do đúng tài khoản Search Console cung cấp.

Không giả định file xác minh đang có trong repository thuộc tài khoản Google mới;
phải bấm Verify để xác nhận thực tế.

Hướng dẫn chính thức: <https://support.google.com/webmasters/answer/9008080>

### 9.2. Gửi sitemap

1. Trong Search Console chọn property `doraecoffee.io.vn`.
2. Chọn **Sitemaps**.
3. Nhập `sitemap.xml`.
4. Chọn **Submit**.
5. Trạng thái cần đạt: **Success**.
6. Kiểm tra định kỳ lỗi đọc sitemap và số URL được phát hiện.

Sitemap production: <https://doraecoffee.io.vn/sitemap.xml>

Hướng dẫn chính thức: <https://support.google.com/webmasters/answer/7451001>

### 9.3. Theo dõi index

Mỗi tuần kiểm tra:

- **Page indexing**: số URL đã index và lý do chưa index;
- **URL Inspection**: kiểm tra trang quan trọng;
- **Performance → Search results**: clicks, impressions, CTR và vị trí;
- **Core Web Vitals**: trải nghiệm thực tế của người dùng.

Không yêu cầu index hàng loạt mỗi ngày. Với nhiều URL, dùng sitemap để Google tự
crawl; URL Inspection chỉ nên dùng cho trang quan trọng hoặc vừa sửa lỗi.

## 10. Bước 8 — Liên kết Search Console với GA4

Điều kiện:

- Có quyền Editor trong GA4;
- là Verified owner của Search Console;
- hai hệ thống đo cùng website.

Thực hiện:

1. Vào **GA4 → Admin → Product links → Search Console Links**.
2. Chọn **Link**.
3. Chọn Search Console property `doraecoffee.io.vn`.
4. Chọn web data stream `Dorae Coffee Website`.
5. Kiểm tra và chọn **Submit**.
6. Trong **Reports → Library**, xuất bản nhóm báo cáo Search Console nếu nhóm này
   chưa hiển thị.

Dữ liệu Search Console có thể chậm khoảng 48 giờ. Google lưu tối đa 16 tháng dữ
liệu Search Console trong báo cáo liên kết. Một web stream chỉ liên kết với một
Search Console property.

Hướng dẫn chính thức: <https://support.google.com/analytics/answer/10737381>

## 11. Bước 9 — Đo backlink và liên kết nội bộ

### 11.1. Backlink

Nguồn chính miễn phí: **Search Console → Links → External links**.

Định nghĩa KPI khuyến nghị:

> Số backlink mới hợp lệ là số URL nguồn bên ngoài mới được phát hiện, trỏ đến
> URL chuẩn (canonical) của Dorae Coffee, không phải số lần một liên kết được lặp
> trên cùng một trang.

Quy trình cuối tháng:

1. Mở **Links → External links**.
2. Xuất **Latest links** ra CSV hoặc Google Sheets.
3. Loại link từ chính tên miền Dorae Coffee.
4. Loại bản ghi trùng `source URL → target URL`.
5. Ghi ngày Google phát hiện nếu dữ liệu xuất có cung cấp.
6. Lưu file theo tên `backlinks-YYYY-MM.csv`.
7. So sánh với bản xuất tháng trước để tính backlink mới.

Search Console chỉ cung cấp mẫu liên kết Google phát hiện, không phải danh sách
tuyệt đối đầy đủ. Nếu backlink là KPI có cam kết thương mại, nên đối chiếu thêm
Ahrefs hoặc Semrush và sử dụng cố định một nhà cung cấp trong toàn kỳ báo cáo.

Hướng dẫn chính thức: <https://support.google.com/webmasters/answer/9049606>

### 11.2. Liên kết nội bộ

Chạy công cụ của dự án:

```powershell
npm run audit:kpi
```

Báo cáo được ghi tại `reports/kpi-audit.json`.

Sử dụng trường:

- `internalLinkOccurrences`: tổng số lần liên kết nội bộ xuất hiện;
- `uniqueInternalLinks`: số cặp `trang nguồn → trang đích` duy nhất;
- `uniqueInternalDestinations`: số URL đích nội bộ khác nhau;
- `brokenPages`: trang sitemap trả lỗi.

KPI “41 liên kết nội bộ” nên chốt theo `uniqueInternalLinks`, vì cách này không
thổi phồng số liệu khi cùng một liên kết lặp lại nhiều lần trên một trang.

## 12. Bước 10 — Áp dụng UTM cho mạng xã hội

Mọi liên kết đăng từ Facebook, Zalo hoặc TikTok về website phải có UTM.

Ví dụ tạo link:

```powershell
npm run utm -- --source facebook --medium organic_social --campaign august_2026 --content post_01
```

Quy ước:

- `utm_source`: `facebook`, `zalo` hoặc `tiktok`;
- `utm_medium`: `organic_social` hoặc `paid_social`;
- `utm_campaign`: tên chiến dịch hoặc tháng, ví dụ `august_2026`;
- `utm_content`: mã bài đăng, ví dụ `post_01`, `video_02`, `bio_link`.

Không dùng chữ hoa, dấu tiếng Việt hoặc khoảng trắng trong giá trị UTM. Không gắn
UTM cho liên kết từ một trang trên website sang trang khác trong cùng website.

KPI “Mạng xã hội tự nhiên” nên được định nghĩa là:

> Số phiên có `Session medium = organic_social` và `Session source` thuộc
> `facebook`, `zalo` hoặc `tiktok`.

## 13. Bước 11 — Tạo dashboard Looker Studio

Chỉ tạo dashboard sau khi GA4 và Search Console đã có dữ liệu hợp lệ.

1. Truy cập `https://lookerstudio.google.com/`.
2. Chọn **Create → Report**.
3. Thêm nguồn dữ liệu **Google Analytics** và chọn GA4 property Dorae Coffee.
4. Thêm nguồn dữ liệu **Search Console** và chọn property tương ứng.
5. Đặt tên báo cáo: `Dorae Coffee - Dashboard hiệu suất`.
6. Thêm bộ lọc ngày và bộ so sánh với kỳ trước.

Nên chia dashboard thành bốn trang:

### Trang 1 — Tổng quan

- Users;
- Sessions;
- Views;
- Key events;
- Purchases;
- Revenue;
- tỷ lệ `purchase / sessions`;
- tỷ lệ `generate_lead / sessions`.

### Trang 2 — SEO

- Organic clicks;
- Impressions;
- CTR;
- Average position;
- landing page;
- search query;
- số bài xuất bản theo tháng.

### Trang 3 — Ecommerce

- `view_item`;
- `add_to_cart`;
- `begin_checkout`;
- `purchase`;
- tỷ lệ chuyển đổi giữa từng bước;
- doanh thu và giá trị đơn hàng trung bình.

### Trang 4 — Kênh và chiến dịch

- Session source/medium;
- Session campaign;
- Organic social sessions;
- key events theo nguồn;
- doanh thu theo nguồn.

Hướng dẫn chính thức: <https://support.google.com/looker-studio/answer/06292570>

## 14. Định nghĩa KPI chính thức

| KPI | Định nghĩa | Nguồn dữ liệu | Chu kỳ |
| --- | --- | --- | --- |
| Lưu lượng truy cập | Sessions, không dùng Views | GA4 | Hàng tháng |
| Bài viết SEO | Bài có trạng thái published và `published_at` trong tháng | CMS/API | Hàng tháng |
| Backlink | Cặp source URL → target canonical URL mới, không trùng | Search Console/Ahrefs/Semrush | Hàng tháng |
| Liên kết nội bộ | Cặp trang nguồn → trang đích duy nhất | `npm run audit:kpi` | Hàng tháng |
| Mạng xã hội tự nhiên | Sessions có medium `organic_social` từ nguồn đã quy định | GA4 + UTM | Hàng tháng |
| Đơn hàng | Số `transaction_id` duy nhất | GA4 đối chiếu D1 | Hàng tháng |
| Doanh thu | Tổng `value` của đơn hợp lệ | D1 là nguồn chính, GA4 để phân tích marketing | Hàng tháng |
| Lead | Số lần API xác nhận biểu mẫu liên hệ | GA4 đối chiếu D1 | Hàng tháng |

D1/backend là nguồn sự thật cho đơn hàng và doanh thu. GA4 dùng để phân tích hành
trình và nguồn marketing, không thay thế dữ liệu vận hành.

## 15. Checklist nghiệm thu

Chỉ xem hệ thống là hoàn tất khi tất cả mục sau đều đạt:

- [ ] Có GA4 property và web data stream đúng tên miền.
- [ ] Có GTM container và ít nhất hai tài khoản có quyền quản trị.
- [ ] Website production đã gắn Container ID thật.
- [ ] Banner consent xuất hiện ở phiên truy cập mới.
- [ ] Từ chối consent không tải analytics.
- [ ] Đồng ý consent cho phép GTM/GA4 hoạt động.
- [ ] Realtime nhận `page_view`.
- [ ] DebugView nhận đủ tám sự kiện tùy chỉnh/ecommerce.
- [ ] `purchase` không bị trùng và khớp đơn trong D1.
- [ ] Không có PII trong event parameters.
- [ ] `purchase` và `generate_lead` là Key events.
- [ ] Search Console đã xác minh Owner.
- [ ] Sitemap có trạng thái Success.
- [ ] GA4 đã liên kết Search Console.
- [ ] Có ít nhất một liên kết UTM thử nghiệm được GA4 nhận đúng nguồn.
- [ ] Dashboard Looker Studio đã có bộ lọc ngày và bốn nhóm báo cáo.
- [ ] Đã lưu bản xuất backlink đầu kỳ để làm mốc so sánh.
- [ ] Đã chạy `npm run audit:kpi` và không có `brokenPages`.

## 16. Quy trình vận hành hàng tháng

Ngày đầu mỗi tháng:

1. Chạy `npm run audit:kpi`.
2. Xuất Search Console Performance của tháng trước.
3. Xuất Search Console Links và so sánh backlink.
4. Đối chiếu GA4 `purchase` với tổng đơn hàng D1.
5. Kiểm tra các nguồn có `(not set)`, `(direct)` tăng bất thường hoặc UTM sai.
6. Cập nhật dashboard và ghi chú các chiến dịch trong tháng.
7. Lưu dữ liệu theo cấu trúc `YYYY-MM` để có lịch sử đối chiếu.

Mỗi quý:

1. Kiểm tra quyền truy cập GA4, GTM, Search Console và Looker Studio.
2. Kiểm thử lại consent trên máy tính và điện thoại.
3. Kiểm tra sự kiện trùng, tham số thiếu và dữ liệu cá nhân.
4. Xem lại định nghĩa KPI trước khi thay đổi dashboard.

## 17. Thứ tự triển khai khuyến nghị

1. Tạo GA4 và lấy `G-...`.
2. Tạo GTM và lấy `GTM-...`.
3. Gắn `GTM-...` vào website và deploy.
4. Tạo Google tag cùng GA4 Event tag trong GTM.
5. Kiểm thử consent, GTM Preview và GA4 DebugView.
6. Publish GTM.
7. Đánh dấu Key events.
8. Xác minh Search Console và gửi sitemap.
9. Liên kết Search Console với GA4.
10. Áp dụng UTM cho toàn bộ bài đăng mạng xã hội.
11. Tạo dashboard Looker Studio.
12. Xuất backlink đầu kỳ và bắt đầu quy trình báo cáo hàng tháng.

Sau khi hoàn thành các bước trên và có ít nhất một chu kỳ kiểm thử không phát hiện
sự kiện trùng hoặc sai giá trị, hệ thống mới nên được dùng để đánh giá hiệu suất
marketing và đưa ra quyết định ngân sách.
