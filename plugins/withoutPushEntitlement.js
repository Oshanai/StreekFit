/**
 * expo-notifications' config plugin adds the `aps-environment` (remote push)
 * entitlement, but free personal Apple teams can't sign it — and we only use
 * LOCAL notifications (streak reminders). Strip it until the paid Apple
 * Developer account lands; real push (APNs) returns with Phase 9.
 */

const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
