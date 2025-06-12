/**
 * Proof of concept for Lattice Atoms
 * 
 * This demonstrates how the same atom definitions can be executed
 * either atomically (with Jotai) or as a store (with any adapter)
 */

// Define state structure using atoms
const defineUserDashboard = (atoms: AtomTools) => {
  // Basic atoms
  const user = atoms.primitive<User | null>(null);
  const notifications = atoms.primitive<Notification[]>([]);
  const settings = atoms.primitive({
    theme: 'light' as 'light' | 'dark',
    emailDigest: true,
    compactView: false
  });
  
  // Computed atoms - these work whether executed atomically or as store!
  const unreadCount = atoms.computed(({ get }) => 
    get(notifications).filter(n => !n.read).length
  );
  
  const greeting = atoms.computed(({ get }) => {
    const currentUser = get(user);
    if (!currentUser) return 'Welcome!';
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    return `Good ${timeOfDay}, ${currentUser.name}!`;
  });
  
  const displayMode = atoms.computed(({ get }) => ({
    isDark: get(settings).theme === 'dark',
    isCompact: get(settings).compactView,
    hasNotifications: get(notifications).length > 0
  }));
  
  // Action atoms
  const login = atoms.action(async ({ set }, credentials: Credentials) => {
    const userData = await api.authenticate(credentials);
    set(user, userData);
    // Load initial data
    const userNotifications = await api.getNotifications(userData.id);
    set(notifications, userNotifications);
  });
  
  const markAsRead = atoms.action(({ get, set }, notificationId: string) => {
    set(notifications, get(notifications).map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    ));
  });
  
  const updateSettings = atoms.action(({ get, set }, updates: Partial<Settings>) => {
    set(settings, { ...get(settings), ...updates });
  });
  
  return {
    // State atoms
    user,
    notifications,
    settings,
    
    // Computed atoms
    unreadCount,
    greeting,
    displayMode,
    
    // Actions
    login,
    markAsRead,
    updateSettings
  };
};

// ============================================
// SCENARIO 1: Execute as atoms with Jotai
// ============================================

const dashboardAtoms = createJotaiAtoms(defineUserDashboard);

// React component with fine-grained reactivity
function JotaiDashboard() {
  // Only re-renders when greeting changes
  const greeting = useAtomValue(dashboardAtoms.greeting);
  
  // Only re-renders when unread count changes
  const unreadCount = useAtomValue(dashboardAtoms.unreadCount);
  
  // Only re-renders when display mode changes
  const { isDark } = useAtomValue(dashboardAtoms.displayMode);
  
  const markAsRead = useSetAtom(dashboardAtoms.markAsRead);
  
  return (
    <div className={isDark ? 'dark' : 'light'}>
      <h1>{greeting}</h1>
      <Badge count={unreadCount} />
      {/* Component only re-renders when specific atoms change */}
    </div>
  );
}

// ============================================
// SCENARIO 2: Execute as store with Zustand
// ============================================

const dashboardStore = createZustandAdapter(
  createStoreFromAtoms(defineUserDashboard)
);

// Same logic, different execution model
function ZustandDashboard() {
  // Select multiple values at once
  const { greeting, unreadCount, isDark } = useSliceValues(dashboardStore, s => ({
    greeting: s.greeting(),
    unreadCount: s.unreadCount(),
    isDark: s.displayMode().isDark
  }));
  
  return (
    <div className={isDark ? 'dark' : 'light'}>
      <h1>{greeting}</h1>
      <Badge count={unreadCount} />
      {/* Same UI, different state management approach */}
    </div>
  );
}

// ============================================
// SCENARIO 3: Same atoms, different app needs
// ============================================

// App A: Needs fine-grained reactivity for real-time features
const realtimeApp = createJotaiAtoms(defineUserDashboard);
// Every notification update is surgical

// App B: Needs SSR and prefers store patterns  
const ssrApp = createReduxAdapter(createStoreFromAtoms(defineUserDashboard));
// Same logic, Redux patterns for server rendering

// App C: Team prefers Vue with Pinia
const vueApp = createPiniaAdapter(createStoreFromAtoms(defineUserDashboard));
// Same logic, works in Vue ecosystem

// ============================================
// The Magic: It's all the same logic!
// ============================================

// The atom definitions are the source of truth
// The execution mode is just an implementation detail
// You can even mix approaches in the same app:

const hybridApp = createHybridExecution(defineUserDashboard, {
  // Use atoms for frequently changing UI state
  atomic: ['notifications', 'unreadCount'],
  
  // Use store for bulk data and settings
  store: ['user', 'settings', 'updateSettings']
});

// This is the future of portable state management!