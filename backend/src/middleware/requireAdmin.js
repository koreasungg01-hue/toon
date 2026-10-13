
export function requireAdmin(req, res, next) {
  const admins = (process.env.ADMIN_UIDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  if (!admins.includes(req.user.uid)) {
    return res.status(403).json({
      error: '관리자 권한이 필요하다.'
    });
  }

  if (req.profile?.status !== 'approved') {
    return res.status(403).json({
      error: '승인된 관리자만 이용할 수 있다.'
    });
  }

  next();
}
