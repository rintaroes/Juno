import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const ONBOARDING_COMPLETION_KEY = 'juno_onboarding_completed';

export type InviteFriend = {
  name: string;
  phone: string;
  status: 'pending' | 'sent';
};

type OnboardingPermissions = {
  location: boolean;
  notifications: boolean;
  contacts: boolean;
};

type OnboardingState = {
  currentStep: number;
  selectedReasons: string[];
  invitedFriends: InviteFriend[];
  permissions: OnboardingPermissions;
  selectedTier: 'annual' | 'monthly';
  completed: boolean;
  inviteMessage: string;
  hasHydrated: boolean;
  setCurrentStep: (step: number) => void;
  toggleReason: (reason: string) => void;
  clearReasons: () => void;
  addFriend: (friend: InviteFriend) => void;
  removeFriend: (phone: string) => void;
  markInvitesSent: () => void;
  setPermission: (key: keyof OnboardingPermissions, value: boolean) => void;
  setSelectedTier: (tier: 'annual' | 'monthly') => void;
  setInviteMessage: (message: string) => void;
  markCompleted: () => Promise<void>;
  setHasHydrated: (value: boolean) => void;
  resetOnboarding: () => Promise<void>;
};

const defaultInviteMessage =
  "Hey - I just joined Juno. It's a safety app for our group. Download it so we can look out for each other: [link]";

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      selectedReasons: [],
      invitedFriends: [],
      permissions: { location: false, notifications: false, contacts: false },
      selectedTier: 'annual',
      completed: false,
      inviteMessage: defaultInviteMessage,
      hasHydrated: false,
      setCurrentStep: (step) => set({ currentStep: step }),
      toggleReason: (reason) =>
        set((state) => ({
          selectedReasons: state.selectedReasons.includes(reason)
            ? state.selectedReasons.filter((entry) => entry !== reason)
            : [...state.selectedReasons, reason],
        })),
      clearReasons: () => set({ selectedReasons: [] }),
      addFriend: (friend) =>
        set((state) => ({
          invitedFriends:
            state.invitedFriends.find((entry) => entry.phone === friend.phone) ?? null
              ? state.invitedFriends
              : [...state.invitedFriends, friend].slice(0, 5),
        })),
      removeFriend: (phone) =>
        set((state) => ({
          invitedFriends: state.invitedFriends.filter((entry) => entry.phone !== phone),
        })),
      markInvitesSent: () =>
        set((state) => ({
          invitedFriends: state.invitedFriends.map((entry) => ({
            ...entry,
            status: 'sent',
          })),
        })),
      setPermission: (key, value) =>
        set((state) => ({ permissions: { ...state.permissions, [key]: value } })),
      setSelectedTier: (tier) => set({ selectedTier: tier }),
      setInviteMessage: (message) => set({ inviteMessage: message }),
      markCompleted: async () => {
        set({ completed: true });
        await AsyncStorage.setItem(ONBOARDING_COMPLETION_KEY, 'true');
      },
      setHasHydrated: (value) => set({ hasHydrated: value }),
      resetOnboarding: async () => {
        set({
          currentStep: 1,
          selectedReasons: [],
          invitedFriends: [],
          permissions: { location: false, notifications: false, contacts: false },
          selectedTier: 'annual',
          completed: false,
          inviteMessage: defaultInviteMessage,
        });
        await AsyncStorage.removeItem(ONBOARDING_COMPLETION_KEY);
      },
    }),
    {
      name: 'juno_onboarding_state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentStep: state.currentStep,
        selectedReasons: state.selectedReasons,
        invitedFriends: state.invitedFriends,
        permissions: state.permissions,
        selectedTier: state.selectedTier,
        completed: state.completed,
        inviteMessage: state.inviteMessage,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
