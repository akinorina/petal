import { User } from '../domain/user';

/**
 * UserService が Controller に返す User とその Cognito 由来の付随状態。
 * - invitationPending: Cognito の UserStatus が FORCE_CHANGE_PASSWORD のとき true
 *   （= 一時パスワードのままで初回ログイン未了）。softDelete 済みは常に false。
 */
export type UserWithStatus = {
  user: User;
  invitationPending: boolean;
};
