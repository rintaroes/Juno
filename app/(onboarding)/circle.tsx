import * as Contacts from 'expo-contacts';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { OnboardingBody, OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { trackOnboardingEvent } from '../../lib/onboardingAnalytics';
import { sendOnboardingInvites } from '../../lib/onboardingInvites';
import { useOnboardingStore } from '../../stores/onboardingStore';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

export default function CircleScreen() {
  const router = useRouter();
  const invitedFriends = useOnboardingStore((state) => state.invitedFriends);
  const addFriend = useOnboardingStore((state) => state.addFriend);
  const removeFriend = useOnboardingStore((state) => state.removeFriend);
  const inviteMessage = useOnboardingStore((state) => state.inviteMessage);
  const setInviteMessage = useOnboardingStore((state) => state.setInviteMessage);
  const markInvitesSent = useOnboardingStore((state) => state.markInvitesSent);
  const setPermission = useOnboardingStore((state) => state.setPermission);
  useOnboardingStep(13, 'circle');

  useEffect(() => {
    void Contacts.requestPermissionsAsync().then(({ status }) => {
      setPermission('contacts', status === 'granted');
    });
  }, [setPermission]);

  const slotCount = useMemo(() => Math.max(3, invitedFriends.length), [invitedFriends.length]);

  const addFromContacts = async () => {
    try {
      const picked = await Contacts.presentContactPickerAsync();
      const phone = picked?.phoneNumbers?.[0]?.number ?? '';
      if (!picked?.name || !phone) return;
      addFriend({ name: picked.name, phone, status: 'pending' });
      void trackOnboardingEvent('onboarding_friend_added', { name: picked.name });
    } catch {
      addFriend({ name: 'Friend', phone: `+1 555 01${Math.floor(Math.random() * 90) + 10}`, status: 'pending' });
    }
  };

  const onSendInvites = async () => {
    await sendOnboardingInvites(invitedFriends, inviteMessage);
    markInvitesSent();
    void trackOnboardingEvent('onboarding_invites_sent', { count: invitedFriends.length });
    router.push('/(onboarding)/permissions');
  };

  return (
    <OnboardingScreen step={13}>
      <View style={styles.main}>
        <OnboardingHeader>Who&apos;s in your circle?</OnboardingHeader>
        <OnboardingBody>
          Juno works best with the friends you actually trust. Add 2-3 of them now - we&apos;ll text
          them an invite. They don&apos;t have to join right away, but the app&apos;s better when they do.
        </OnboardingBody>
        <View style={styles.slots}>
          {Array.from({ length: slotCount }).map((_, index) => {
            const friend = invitedFriends[index];
            if (!friend) {
              return (
                <Pressable key={index} style={styles.slot} onPress={() => void addFromContacts()}>
                  <Text style={styles.slotEmpty}>+ Add a friend</Text>
                </Pressable>
              );
            }
            const initials = friend.name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
            return (
              <View key={friend.phone} style={styles.slot}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
                <View style={styles.friendMeta}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  <Text style={styles.friendPhone}>{friend.phone.slice(-4).padStart(friend.phone.length, '*')}</Text>
                </View>
                <Pressable onPress={() => removeFriend(friend.phone)}><Text style={styles.remove}>x</Text></Pressable>
              </View>
            );
          })}
        </View>
        <Pressable onPress={() => void addFromContacts()}><Text style={styles.addAnother}>+ Add another</Text></Pressable>
        <View style={styles.previewCard}>
          <TextInput multiline value={inviteMessage} onChangeText={setInviteMessage} style={styles.previewInput} />
        </View>
      </View>
      <View>
        <OnboardingButton
          label={`Send invites (${invitedFriends.length})`}
          onPress={() => void onSendInvites()}
          disabled={invitedFriends.length < 1}
        />
        <OnboardingButton variant="ghost" label="Skip for now" onPress={() => router.push('/(onboarding)/permissions')} />
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 14 },
  slots: { gap: 10 },
  slot: {
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: colors.stone,
    borderRadius: 16,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  slotEmpty: { color: colors.stone, fontFamily: fontFamily.inter, fontSize: 15, textAlign: 'center', flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 999, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.cream, fontFamily: fontFamily.interMedium, fontSize: 14 },
  friendMeta: { flex: 1 },
  friendName: { fontFamily: fontFamily.interMedium, color: colors.charcoal, fontSize: 14 },
  friendPhone: { fontFamily: fontFamily.inter, color: colors.stone, fontSize: 13 },
  remove: { color: colors.stone, fontFamily: fontFamily.interMedium, fontSize: 18 },
  addAnother: { color: colors.stone, fontFamily: fontFamily.inter, fontSize: 14, textDecorationLine: 'underline' },
  previewCard: { borderWidth: 1, borderColor: colors.stone, borderRadius: 16, padding: 12 },
  previewInput: { minHeight: 88, color: colors.charcoal, fontFamily: fontFamily.inter, fontSize: 14, lineHeight: 20 },
});
