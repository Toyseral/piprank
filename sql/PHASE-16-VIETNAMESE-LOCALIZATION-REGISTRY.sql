
-- Optional compatibility seed for Vietnamese language + commercial drafts.
-- Hard-coded Vietnamese pages remain as fallback until rows are published.
DO $$
DECLARE cid bigint;
DECLARE lid bigint;
BEGIN
  SELECT id INTO cid FROM public.countries WHERE slug='vietnam' LIMIT 1;
  IF cid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.country_languages(country_id,name,native_name,code,locale,url_prefix,is_default,active)
  VALUES(cid,'Vietnamese','Tiếng Việt','vi','vi-VN','vi',false,true)
  ON CONFLICT(country_id,code) DO UPDATE SET native_name=EXCLUDED.native_name, locale=EXCLUDED.locale, url_prefix=EXCLUDED.url_prefix, active=true
  RETURNING id INTO lid;

  IF lid IS NULL THEN
    SELECT id INTO lid FROM public.country_languages WHERE country_id=cid AND code='vi' LIMIT 1;
  END IF;

  IF lid IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.localized_seo_pages(country_id,language_id,topic_key,slug,title,meta_title,meta_description,h1,content,faqs,indexable,published,workflow_status)
  VALUES
  (cid, lid, 'all', 'broker-forex-tot-nhat', 'Broker Forex Tốt Nhất tại Việt Nam',
   'Broker Forex Tốt Nhất tại Việt Nam 2026 | PipRank',
   'So sánh các broker forex tốt nhất tại Việt Nam. Xem phí giao dịch, nền tảng, điều kiện tài khoản và mức độ phù hợp với trader Việt Nam.',
   'Broker Forex Tốt Nhất tại Việt Nam',
   'So sánh các broker forex được PipRank đánh giá phù hợp với trader tại Việt Nam. Bảng xếp hạng bắt đầu từ nhóm broker được đề xuất cho Việt Nam, thay vì trộn trực tiếp với danh sách toàn cầu.

Điều kiện giao dịch, pháp nhân, đòn bẩy, phương thức nạp rút và quy định có thể khác nhau theo quốc gia và pháp nhân. Hãy kiểm tra điều khoản hiện hành trước khi mở tài khoản.',
   '[{"q":"Broker forex nào tốt nhất tại Việt Nam?","a":"PipRank bắt đầu từ nhóm broker được đề xuất cho Việt Nam và đánh giá mức độ phù hợp dựa trên chi phí, nền tảng, tính năng tài khoản, độ tin cậy và nhu cầu giao dịch."},{"q":"PipRank xếp hạng broker forex tại Việt Nam như thế nào?","a":"PipRank sử dụng dữ liệu theo quốc gia trước, sau đó đánh giá các yếu tố như spread, nền tảng, tài khoản, điều kiện giao dịch và các tín hiệu về độ tin cậy."}]'::jsonb,
   false, false, 'draft'),
  (cid, lid, 'beginners', 'broker-forex-tot-nhat-cho-nguoi-moi', 'Broker Forex Tốt Nhất Cho Người Mới tại Việt Nam',
   'Broker Forex Tốt Nhất Cho Người Mới tại Việt Nam 2026 | PipRank',
   'So sánh broker forex phù hợp cho người mới tại Việt Nam, tập trung vào tài khoản demo, nền tảng dễ sử dụng, mức nạp tối thiểu và điều kiện giao dịch.',
   'Broker Forex Tốt Nhất Cho Người Mới',
   'Trang này tập trung vào broker forex phù hợp với người mới tại Việt Nam, ưu tiên khả năng tiếp cận, tài khoản demo, nền tảng dễ dùng và điều kiện tài khoản rõ ràng.

Broker phù hợp nhất phụ thuộc vào kinh nghiệm, ngân sách, nền tảng và sản phẩm bạn muốn giao dịch.',
   '[{"q":"Broker forex nào tốt cho người mới ở Việt Nam?","a":"PipRank ưu tiên các broker trong nhóm Việt Nam có dữ liệu phù hợp với người mới như tài khoản demo, mức nạp thấp và nền tảng dễ tiếp cận."}]'::jsonb,
   false, false, 'draft'),
  (cid, lid, 'mt4', 'broker-mt4-tot-nhat', 'Broker MT4 Tốt Nhất tại Việt Nam',
   'Broker MT4 Tốt Nhất tại Việt Nam 2026 | PipRank',
   'So sánh các broker MT4 tốt nhất cho trader tại Việt Nam, bao gồm nền tảng, spread, tài khoản và điều kiện giao dịch.',
   'Broker MT4 Tốt Nhất',
   'Trang này lọc nhóm broker được đề xuất cho Việt Nam theo khả năng hỗ trợ MetaTrader 4 và các điều kiện giao dịch liên quan.

Kiểm tra đúng pháp nhân, loại tài khoản và phiên bản MT4 được cung cấp cho cư dân Việt Nam trước khi mở tài khoản.',
   '[{"q":"Broker MT4 nào tốt nhất tại Việt Nam?","a":"PipRank lọc nhóm broker Việt Nam theo hỗ trợ MT4 rồi xếp hạng dựa trên dữ liệu chi phí, tính năng và độ tin cậy có sẵn."}]'::jsonb,
   false, false, 'draft'),
  (cid, lid, 'mt5', 'broker-mt5-tot-nhat', 'Broker MT5 Tốt Nhất tại Việt Nam',
   'Broker MT5 Tốt Nhất tại Việt Nam 2026 | PipRank',
   'So sánh các broker MT5 tốt nhất tại Việt Nam, với thông tin về spread, tài khoản, nền tảng và điều kiện giao dịch.',
   'Broker MT5 Tốt Nhất',
   'Trang này lọc nhóm broker được đề xuất cho Việt Nam theo hỗ trợ MetaTrader 5 và các tiêu chí liên quan đến nền tảng.',
   '[{"q":"Broker MT5 nào tốt nhất tại Việt Nam?","a":"PipRank bắt đầu từ nhóm broker Việt Nam rồi lọc theo hỗ trợ MT5 và đánh giá thêm chi phí, tính năng tài khoản và độ tin cậy."}]'::jsonb,
   false, false, 'draft'),
  (cid, lid, 'gold', 'broker-giao-dich-vang-tot-nhat', 'Broker Forex Tốt Nhất Để Giao Dịch Vàng tại Việt Nam',
   'Broker Giao Dịch Vàng Tốt Nhất tại Việt Nam 2026 | PipRank',
   'So sánh broker forex phù hợp để giao dịch vàng tại Việt Nam, tập trung vào chi phí, nền tảng, sản phẩm và điều kiện tài khoản.',
   'Broker Giao Dịch Vàng Tốt Nhất',
   'Trang này tập trung vào broker trong nhóm Việt Nam có hỗ trợ giao dịch vàng và phù hợp hơn với nhu cầu giao dịch XAU/USD.',
   '[{"q":"Broker nào tốt để giao dịch vàng tại Việt Nam?","a":"PipRank lọc nhóm broker Việt Nam theo khả năng hỗ trợ vàng rồi xem xét thêm chi phí, nền tảng, tài khoản và các tín hiệu về chất lượng broker."}]'::jsonb,
   false, false, 'draft'),
  (cid, lid, 'low-spread', 'broker-forex-spread-thap', 'Broker Forex Có Spread Thấp tại Việt Nam',
   'Broker Forex Có Spread Thấp tại Việt Nam 2026 | PipRank',
   'So sánh broker forex có spread thấp cho trader tại Việt Nam, cùng thông tin về tài khoản, nền tảng và chi phí giao dịch.',
   'Broker Forex Có Spread Thấp',
   'Trang này lọc nhóm broker được đề xuất cho Việt Nam theo dữ liệu spread và các điều kiện chi phí liên quan.',
   '[{"q":"Broker forex nào có spread thấp tại Việt Nam?","a":"PipRank lọc nhóm broker Việt Nam theo dữ liệu spread hiện có và xem xét thêm chất lượng broker, tài khoản và nền tảng."}]'::jsonb,
   false, false, 'draft')
  ON CONFLICT (language_id, topic_key) DO UPDATE SET
    slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    meta_title = EXCLUDED.meta_title,
    meta_description = EXCLUDED.meta_description,
    h1 = EXCLUDED.h1,
    content = CASE WHEN public.localized_seo_pages.content IS NULL OR public.localized_seo_pages.content = '' THEN EXCLUDED.content ELSE public.localized_seo_pages.content END,
    faqs = CASE WHEN public.localized_seo_pages.faqs = '[]'::jsonb THEN EXCLUDED.faqs ELSE public.localized_seo_pages.faqs END,
    updated_at = now();
END $$;
