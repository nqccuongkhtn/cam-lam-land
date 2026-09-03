/* =====================================================================
 *  DVHC 3 CẤP → 2 CẤP (MPLIS / VBDLIS)  —  bộ quy tắc + công cụ
 *  ---------------------------------------------------------------
 *  Rút ra bằng cách đọc thẳng danh mục của hệ thống (DanhMucAjax) trên
 *  khh.mplis.gov.vn, đối chiếu số liệu toàn quốc:
 *      35 tỉnh · 744 huyện (TẤT CẢ trangThai = false) · 10.602 mã xã
 *      3.316 xã "mới" (2 cấp)  +  7.286 xã "cũ" (3 cấp)
 *      0 mã xã bị trùng trên toàn quốc
 *
 *  KHÔNG phụ thuộc thư viện. Chạy được cả trong trình duyệt (trên trang
 *  MPLIS) lẫn Node (khi đã có sẵn dữ liệu danh mục).
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DVHC = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------
   * 1. RÚT DANH MỤC TỪ TRANG MPLIS
   *    Dán vào Console của bất kỳ cổng MPLIS tỉnh nào (đã đăng nhập).
   *    Ba hàm dưới đây là ĐỒNG BỘ — đọc từ bộ nhớ đệm của trang, không
   *    gọi mạng, nên lấy cả nước chỉ mất vài giây.
   * ---------------------------------------------------------------- */
  function extract(D) {
    D = D || (typeof window !== 'undefined' && window.DanhMucAjax);
    if (!D) throw new Error('Không thấy DanhMucAjax — phải chạy trên trang MPLIS đã đăng nhập.');
    var provinces = [], districts = [], wards = [], seen = {};
    (D.GetAllProvince() || []).forEach(function (p) {
      provinces.push({
        tinhId: +p.tinhId, maTinh: p.maTinh, ten: p.ten,
        tenCu: p.tenCu || '', trangThai: !!p.trangThai
      });
      var ds = [];
      try { ds = D.GetDistrictByProvinceId(String(p.tinhId)) || []; } catch (e) { ds = []; }
      ds.forEach(function (d) {
        districts.push({
          huyenId: +d.huyenId, maHuyen: d.maHuyen || d.mahuyen, ten: d.ten,
          tinhId: +d.tinhId, tinhIdCu: +d.tinhIdCu, trangThai: !!d.trangThai,
          laKhuVuc: !!d.laKhuVuc, tenCu: d.tenCu || '',
          maXaTrucThuocs: d.maXaTrucThuocs || ''
        });
        var ws = [];
        try { ws = D.GetWardByDistrictId(String(d.huyenId)) || []; } catch (e) { ws = []; }
        ws.forEach(function (w) {
          var k = w.tinhId + '/' + w.huyenId + '/' + w.xaId;
          if (seen[k]) return; seen[k] = 1;
          wards.push({
            xaId: +w.xaId, maXa: w.maXa, ten: w.ten,
            huyenId: +w.huyenId, tinhId: +w.tinhId, tinhIdCu: +w.tinhIdCu,
            trangThai: !!w.trangThai,          // true = xã MỚI (2 cấp)
            tenCu: w.tenCu || '',              // tên xã CŨ đã mang mã này
            parentId: +(w.parentId || 0),      // thực tế: luôn 0
            maXaTrucThuocs: w.maXaTrucThuocs || '',
            khuVucId: +(w.khuVucId || 0),
            isHidden: !!w.isHidden
          });
        });
      });
    });
    return { provinces: provinces, districts: districts, wards: wards };
  }

  /* ------------------------------------------------------------------
   * 2. NĂM QUY TẮC (đã kiểm chứng bằng dữ liệu thật)
   *
   *  R1. KẾ THỪA MÃ. Đơn vị mới KHÔNG được cấp mã mới. Nó LẤY LẠI mã của
   *      ĐÚNG MỘT đơn vị cũ trong nhóm sáp nhập ("đơn vị gốc"). Bằng
   *      chứng: toàn quốc 10.602 mã xã, KHÔNG mã nào lặp lại — bản ghi
   *      xã cũ mang mã đó không còn tồn tại riêng, nó đã BIẾN THÀNH xã mới.
   *
   *  R2. trangThai LÀ CỜ PHÂN CẤP.
   *        true  → đơn vị 2 cấp, đang có hiệu lực (xã/phường/đặc khu mới)
   *        false → đơn vị 3 cấp, chỉ còn giá trị lịch sử
   *      Ở cấp huyện: TOÀN BỘ 744 huyện đều false — đúng bản chất "bỏ cấp
   *      huyện". huyenId chỉ còn là khoá NHÓM để tra cứu, không phải cấp
   *      hành chính nữa.
   *
   *  R3. tenCu = TÊN CŨ CỦA CHÍNH MÃ ĐÓ, không phải danh sách sáp nhập.
   *      Chỉ được điền khi tên đổi. Xã mới giữ nguyên tên đơn vị gốc thì
   *      tenCu rỗng (toàn quốc: 2.229/3.316 xã mới có tenCu).
   *      → tenCu cho biết ĐƠN VỊ GỐC, không cho biết các đơn vị còn lại.
   *
   *  R4. tinhIdCu = TỈNH CŨ. Có trên cả huyện lẫn xã. Đây là đường duy
   *      nhất, và là đường ĐẦY ĐỦ, để dựng bản đồ sáp nhập CẤP TỈNH:
   *      gom tinhIdCu theo tinhId là ra "tỉnh nào nhập vào tỉnh nào".
   *
   *  R5. maXaTrucThuocs = LIÊN KẾT CHÉO, hai chiều, nhưng CHỈ điền cho
   *      trường hợp ngoại lệ (xã chuyển sang huyện/tỉnh khác). Toàn quốc
   *      chỉ 3 bản ghi xã và 4 bản ghi huyện có giá trị. parentId luôn 0.
   *
   *  ⇒ HỆ QUẢ QUAN TRỌNG NHẤT:
   *     Danh mục CHỈ cho biết "mã X nay là xã mới, trước là tên Y".
   *     Nó KHÔNG chứa danh sách đầy đủ "những xã cũ nào nhập vào xã mới".
   *     Muốn danh sách đó phải lấy từ Nghị quyết sắp xếp ĐVHC 2025.
   * ---------------------------------------------------------------- */

  /* ------------------------------------------------------------------
   * 3. DỰNG CÁC BẢNG TRA
   * ---------------------------------------------------------------- */
  function build(cat) {
    var wardById = {}, newWards = [], oldWards = [];
    cat.wards.forEach(function (w) {
      wardById[w.xaId] = w;
      (w.trangThai ? newWards : oldWards).push(w);
    });

    // 3.1 Sáp nhập CẤP TỈNH — đầy đủ, suy từ tinhIdCu (R4)
    var provMerge = {};   // tinhId mới -> { tinhIdCu: số xã }
    cat.wards.forEach(function (w) {
      var m = provMerge[w.tinhId] || (provMerge[w.tinhId] = {});
      m[w.tinhIdCu] = (m[w.tinhIdCu] || 0) + 1;
    });

    // 3.2 Đơn vị gốc của mỗi xã mới (R1 + R3)
    var anchor = {};      // xaId mới -> tên xã cũ đã mang mã đó ('' nếu không đổi tên)
    newWards.forEach(function (w) { anchor[w.xaId] = w.tenCu; });

    // 3.3 Liên kết chéo hai chiều (R5) — ít nhưng phải tôn trọng
    var cross = { oldToNew: {}, newToOld: {} };
    cat.wards.forEach(function (w) {
      if (!w.maXaTrucThuocs) return;
      String(w.maXaTrucThuocs).split(',').forEach(function (s) {
        var id = +String(s).trim(); if (!id) return;
        if (w.trangThai) { (cross.newToOld[w.xaId] = cross.newToOld[w.xaId] || []).push(id); }
        else { cross.oldToNew[w.xaId] = id; }
      });
    });

    // 3.4 Nhóm theo huyện cũ — khoá thực dụng để dò ngược
    var byDistrict = {};  // huyenId -> { moi: [], cu: [] }
    cat.wards.forEach(function (w) {
      var g = byDistrict[w.huyenId] || (byDistrict[w.huyenId] = { moi: [], cu: [] });
      (w.trangThai ? g.moi : g.cu).push(w.xaId);
    });

    return {
      cat: cat, wardById: wardById, newWards: newWards, oldWards: oldWards,
      provMerge: provMerge, anchor: anchor, cross: cross, byDistrict: byDistrict
    };
  }

  /* ------------------------------------------------------------------
   * 4. TRA CỨU HAI CHIỀU
   * ---------------------------------------------------------------- */

  // Cho một mã xã bất kỳ → cho biết nó là cấp mấy và biết được gì về nó.
  function info(M, xaId) {
    var w = M.wardById[xaId];
    if (!w) return null;
    var r = {
      xaId: w.xaId, ten: w.ten, huyenIdCu: w.huyenId, tinhId: w.tinhId, tinhIdCu: w.tinhIdCu,
      cap: w.trangThai ? 2 : 3,
      laXaMoi: w.trangThai
    };
    if (w.trangThai) {
      r.tenDonViGoc = w.tenCu || w.ten;           // R3: rỗng ⇒ giữ nguyên tên
      r.doiTen = !!w.tenCu;
      r.xaCuNhapVao_biet = (M.cross.newToOld[w.xaId] || []).slice();   // R5, thường rỗng
    } else {
      r.xaMoi_biet = M.cross.oldToNew[w.xaId] || null;                 // R5, thường null
      r.ungVienXaMoi = (M.byDistrict[w.huyenId] || { moi: [] }).moi.slice();
    }
    return r;
  }

  // XÃ CŨ → XÃ MỚI. Trả về { chinhXac, ungVien[] , nguon }.
  //   nguon = 'lien-ket-cheo' : hệ thống nói thẳng (chắc chắn)
  //         = 'nghi-quyet'    : lấy từ bảng bổ sung bạn nạp vào (chắc chắn)
  //         = 'suy-doan'      : chỉ còn cách chọn trong các xã mới cùng huyện cũ
  function oldToNew(M, xaIdCu, extraMap) {
    var w = M.wardById[xaIdCu];
    if (!w) return null;
    if (w.trangThai) return { chinhXac: w.xaId, ungVien: [w.xaId], nguon: 'chinh-no-la-xa-moi' };
    if (M.cross.oldToNew[xaIdCu]) return { chinhXac: M.cross.oldToNew[xaIdCu], ungVien: [M.cross.oldToNew[xaIdCu]], nguon: 'lien-ket-cheo' };
    if (extraMap && extraMap[xaIdCu]) return { chinhXac: extraMap[xaIdCu], ungVien: [extraMap[xaIdCu]], nguon: 'nghi-quyet' };
    var ung = (M.byDistrict[w.huyenId] || { moi: [] }).moi.slice();
    return { chinhXac: ung.length === 1 ? ung[0] : null, ungVien: ung, nguon: 'suy-doan' };
  }

  // XÃ MỚI → CÁC XÃ CŨ. Trả về { goc, chacChan[], cungHuyenCu[] }.
  function newToOld(M, xaIdMoi, extraMap) {
    var w = M.wardById[xaIdMoi];
    if (!w || !w.trangThai) return null;
    var chac = (M.cross.newToOld[xaIdMoi] || []).slice();
    if (extraMap) {
      Object.keys(extraMap).forEach(function (cu) {
        if (+extraMap[cu] === +xaIdMoi && chac.indexOf(+cu) < 0) chac.push(+cu);
      });
    }
    return {
      goc: { xaId: w.xaId, ten: w.tenCu || w.ten },     // đơn vị gốc: chính mã này
      chacChan: chac,
      cungHuyenCu: (M.byDistrict[w.huyenId] || { cu: [] }).cu.slice()
    };
  }

  /* ------------------------------------------------------------------
   * 5. QUY TẮC THỰC DỤNG KHI TRA DỮ LIỆU (thửa đất, biến động, hồ sơ)
   *    Hồ sơ cũ VẪN nằm dưới MÃ XÃ CŨ — hệ thống không chuyển dữ liệu
   *    sang mã mới. Vì vậy khi tra một thửa mà không thấy, phải thử lần
   *    lượt các mã xã cũ CÙNG HUYỆN CŨ. Đây chính là cách tiện ích
   *    VBDLIS đang làm (chế độ "3 cấp · xã cũ").
   * ---------------------------------------------------------------- */
  function searchOrder(M, xaId) {
    var w = M.wardById[xaId];
    if (!w) return [xaId];
    var g = M.byDistrict[w.huyenId] || { moi: [], cu: [] };
    var out = [xaId];
    g.moi.forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
    g.cu.forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
    return out;
  }

  return {
    extract: extract, build: build,
    info: info, oldToNew: oldToNew, newToOld: newToOld, searchOrder: searchOrder
  };
});
