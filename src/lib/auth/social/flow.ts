import { createHash } from 'node:crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { z } from 'zod';
import type { Provider } from './config';
import { socialSecret } from './config';

export const FLOW_LIFETIME = 600;
const flowSchema = z.object({
  provider: z.enum(['google', 'apple']), state: z.string().min(32).max(200),
  nonce: z.string().min(32).max(200), verifier: z.string().min(32).max(200),
  proof: z.string().min(32).max(200), returnTo: z.string().max(2000),
  linkUserId: z.string().optional(), linkSession: z.string().optional(),
});
export type SocialFlow = z.infer<typeof flowSchema>;
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const flowIdentifier = (provider: Provider, state: string) => `social:${provider}:${digest(state)}`;
export const flowCookie = (provider: Provider) => `focus_oauth_${provider}`;

export async function sealFlow(flow: SocialFlow, origin: string): Promise<string> {
  return new EncryptJWT(flow).setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuer(origin).setAudience(`focusstore-social:${flow.provider}`).setIssuedAt()
    .setExpirationTime(`${FLOW_LIFETIME}s`).encrypt(createHash('sha256').update(socialSecret()).digest());
}

export async function openFlow(value: string, provider: Provider, origin: string): Promise<SocialFlow> {
  if (value.length > 6000) throw new Error('Invalid flow');
  const { payload } = await jwtDecrypt(value, createHash('sha256').update(socialSecret()).digest(), {
    issuer: origin, audience: `focusstore-social:${provider}`,
    keyManagementAlgorithms: ['dir'], contentEncryptionAlgorithms: ['A256GCM'],
  });
  const result = flowSchema.parse(payload);
  if (result.provider !== provider) throw new Error('Provider mismatch');
  return result;
}
