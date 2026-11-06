import { Handler } from 'express';

/**
 * Rejects every request into organisation data while the requesting user's organisation is
 * frozen or rotating its key, with 423 Locked. Mounted on the data routers; the `/keys` routes
 * that a rotation needs are not behind it. Users without an organisation (Admin, Controller)
 * pass, as they work across organisations and never hold keys.
 *
 * The state comes from the user record loaded by passport for this very request, so a freeze
 * takes effect with the next request of every member.
 */
export const requireOrgNotFrozen: Handler = (req, res, next) => {
  const state = req.user?.organisation?.keyState;
  if (state === 'frozen' || state === 'rotating') {
    res.status(423).json({
      message: 'Locked',
      error:
        state === 'rotating'
          ? 'Der Schlüssel der Organisation wird gerade erneuert.'
          : 'Die Organisation ist eingefroren.',
      keyState: state,
    });
    return;
  }
  next();
};
