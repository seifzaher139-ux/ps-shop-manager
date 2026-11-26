import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type User as FirebaseUser,
} from 'firebase/auth';
import { firebaseClient } from './firebase';
import { FirestoreRepository } from '../data/cloud-repository';
export const cloudRepository = new FirestoreRepository(
  () => firebaseClient().db,
  () => firebaseClient().auth.currentUser?.uid ?? null,
);
export const cloudIdentity = {
  current() {
    return firebaseClient().auth.currentUser;
  },
  observe(
    next: (user: FirebaseUser | null) => void,
    error: (error: Error) => void,
  ) {
    return onAuthStateChanged(firebaseClient().auth, next, error);
  },
  async create(email: string, password: string) {
    return (
      await createUserWithEmailAndPassword(
        firebaseClient().auth,
        email.trim(),
        password,
      )
    ).user;
  },
  async login(email: string, password: string) {
    return (
      await signInWithEmailAndPassword(
        firebaseClient().auth,
        email.trim(),
        password,
      )
    ).user;
  },
  async logout() {
    await signOut(firebaseClient().auth);
  },
  async reset(email: string) {
    await sendPasswordResetEmail(firebaseClient().auth, email.trim());
  },
  async verify(password: string) {
    const user = firebaseClient().auth.currentUser;
    if (!user?.email) throw new Error('cloud-auth-required');
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, password),
    );
  },
  async password(current: string, next: string) {
    await this.verify(current);
    await updatePassword(firebaseClient().auth.currentUser!, next);
  },
};
