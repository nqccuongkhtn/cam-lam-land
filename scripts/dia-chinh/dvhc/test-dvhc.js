// Kiem tra bo quy tac bang du lieu that cua Khanh Hoa
const DVHC = require('./dvhc-2cap.js');
const kh = require('./khanh-hoa-2cap.json');

// dung lai hinh dang danh muc nhu tren trang MPLIS
const wards = [];
kh.xaMoi.forEach(x => wards.push({
  xaId: x.xaId, ten: x.ten, huyenId: x.huyenIdCu, tinhId: 56,
  tinhIdCu: kh.huyenCu.find(h => h.huyenId === x.huyenIdCu).tinhIdCu,
  trangThai: true, tenCu: x.donViGoc,
  maXaTrucThuocs: (x.xaCuNhapVao || []).join(','), parentId: 0, khuVucId: 0
}));
kh.xaCu.forEach(x => wards.push({
  xaId: x.xaId, ten: x.ten, huyenId: x.huyenIdCu, tinhId: 56,
  tinhIdCu: kh.huyenCu.find(h => h.huyenId === x.huyenIdCu).tinhIdCu,
  trangThai: false, tenCu: '',
  maXaTrucThuocs: x.xaMoiNhapVao ? String(x.xaMoiNhapVao) : '', parentId: 0, khuVucId: 0
}));
const cat = { provinces: [{ tinhId: 56, ten: 'tỉnh Khánh Hòa', tenCu: '', trangThai: true }],
              districts: kh.huyenCu.map(h => ({ ...h, tinhId: 56, trangThai: false })), wards };
const M = DVHC.build(cat);

let ok = true;
const chk = (name, cond, extra) => { console.log((cond ? 'OK  ' : 'FAIL') + '  ' + name + (extra ? '  ' + extra : '')); if (!cond) ok = false; };

// R1 — khong ma nao trung
const ids = wards.map(w => w.xaId);
chk('R1 khong co ma xa trung', new Set(ids).size === ids.length, ids.length + ' ma');

// R2 — dem dung so xa moi / cu
chk('R2 dem xa moi/cu', M.newWards.length === 65 && M.oldWards.length === 139,
  M.newWards.length + ' moi / ' + M.oldWards.length + ' cu');

// R4 — sap nhap cap tinh suy tu tinhIdCu
const pm = M.provMerge[56];
chk('R4 Khanh Hoa = 56 + 58', pm && pm[56] === 139 && pm[58] === 65,
  JSON.stringify(pm));

// R5 — lien ket cheo hai chieu
chk('R5 xa cu 22807 -> xa moi 22822', M.cross.oldToNew[22807] === 22822);
chk('R5 xa moi 22822 -> xa cu 22807', (M.cross.newToOld[22822] || [])[0] === 22807);

// tra cuu hai chieu
const a = DVHC.info(M, 22333);
chk('info xa moi 22333', a.cap === 2 && a.tenDonViGoc === 'phường Vĩnh Phước' && a.doiTen === true);
const b = DVHC.info(M, 22423);
chk('info xa moi giu nguyen ten (22423)', b.cap === 2 && b.doiTen === false && b.tenDonViGoc === 'phường Ba Ngòi');
const c = DVHC.info(M, 22336);
chk('info xa cu 22336 (Ngoc Hiep)', c.cap === 3 && c.ungVienXaMoi.length === 4,
  'ung vien: ' + c.ungVienXaMoi.join(','));

// cu -> moi
const r1 = DVHC.oldToNew(M, 22807);
chk('cu->moi bang lien ket cheo', r1.chinhXac === 22822 && r1.nguon === 'lien-ket-cheo');
const r2 = DVHC.oldToNew(M, 22336);
chk('cu->moi phai suy doan (Nha Trang co 4 xa moi)', r2.chinhXac === null && r2.nguon === 'suy-doan' && r2.ungVien.length === 4);
const r3 = DVHC.oldToNew(M, 22336, { 22336: 22390 });
chk('cu->moi khi nap bang nghi quyet', r3.chinhXac === 22390 && r3.nguon === 'nghi-quyet');
const r4 = DVHC.oldToNew(M, 22737);   // Song Tu Tay -> Truong Sa chi co 1 xa moi
chk('cu->moi chac chan khi huyen cu chi con 1 xa moi', r4.chinhXac === 22736);

// moi -> cu
const n1 = DVHC.newToOld(M, 22822);
chk('moi->cu: goc + chac chan', n1.goc.ten === 'xã Mỹ Sơn' && n1.chacChan[0] === 22807);
const n2 = DVHC.newToOld(M, 22333);
chk('moi->cu: Bac Nha Trang goc la Vinh Phuoc', n2.goc.ten === 'phường Vĩnh Phước' && n2.cungHuyenCu.length === 23,
  'xa cu cung huyen: ' + n2.cungHuyenCu.length);

// thu tu tra du lieu
const so = DVHC.searchOrder(M, 22333);
chk('thu tu tra: chinh no truoc, roi xa moi, roi xa cu cung huyen', so[0] === 22333 && so.length === 27, so.length + ' ma');

console.log('\n' + (ok ? 'TAT CA DAT' : 'CO LOI'));
process.exit(ok ? 0 : 1);
