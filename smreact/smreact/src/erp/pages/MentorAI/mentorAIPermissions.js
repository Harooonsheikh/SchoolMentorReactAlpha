import { useCallback } from 'react';
import { usePermissions } from '../../context/PermissionsContext';

export const MENTOR_AI_MENU = 'Mentor AI';

export const MENTOR_AI_SCREEN_LABELS = {
  chat:         'AI Chat Assistant',
  lessonplans:  'Lesson Plans',
  worksheets:   'Worksheet Generator',
  designstudio: 'Design Studio',
  library:      'Library',
  wallet:       'Wallet & Usage',
};

export function useMentorAIScreens() {
  const { canScreen, ready } = usePermissions();
  const canOpen = useCallback((tabId) => {
    const label = MENTOR_AI_SCREEN_LABELS[tabId];
    return label ? canScreen(MENTOR_AI_MENU, label) : true;
  }, [canScreen]);
  return { ready, canOpen };
}

export function useMentorAIActions(tabId, toast) {
  const { can } = usePermissions();
  const label = MENTOR_AI_SCREEN_LABELS[tabId];
  const check = (action) => (label ? can(MENTOR_AI_MENU, label, action) : true);

  const deny = (action) => {
    toast?.(`You don't have ${action} permission for ${label}. Please contact your school admin.`);
  };

  const guard = (action, fn) => (...args) => {
    if (!check(action)) return deny(action);
    return fn?.(...args);
  };

  return {
    canView: check('view'), canCreate: check('create'), canEdit: check('edit'),
    canDownload: check('download'), canDelete: check('delete'),
    deny, guard,
  };
}
