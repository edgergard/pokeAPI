import {
  CONTACT_URL,
  LegalDocument,
  LegalList,
  LegalSection,
  OutboundLink,
} from '@/shared/ui/LegalDocument';

const VERCEL_PRIVACY_URL = 'https://vercel.com/legal/privacy-policy';
const GITHUB_PRIVACY_URL =
  'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement';

/** Privacy policy (launch.md data inventory): everything the game stores stays in the browser. */
export function PrivacyPage() {
  return (
    <LegalDocument title="Privacy">
      <LegalSection title="Who runs Trainer Studio">
        <p>
          Trainer Studio is a free fan project run by the GitHub user <strong>edgergard</strong>.
          For any question about this policy, open an issue at{' '}
          <OutboundLink href={CONTACT_URL}>GitHub Issues</OutboundLink>.
        </p>
      </LegalSection>

      <LegalSection title="The short version">
        <p>
          Your game progress stays in your browser and is never sent to us or anyone else. There are
          no accounts, no analytics, no ads, no tracking cookies and no payments.
        </p>
      </LegalSection>

      <LegalSection title="What is stored on your device">
        <LegalList>
          <li>
            <strong>Game progress</strong> (your collection, levels, capsules, quests and trainer
            name) is saved in your browser&apos;s IndexedDB storage. If your browser blocks
            IndexedDB, progress is kept in session storage for the current tab only. It is never
            uploaded anywhere.
          </li>
          <li>
            <strong>Your motion preference</strong> (full or reduced animations) is saved in your
            browser&apos;s local storage.
          </li>
          <li>
            <strong>Save export files</strong> are created on your device when you choose Export.
            Where you keep or share them is up to you.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="What other services see">
        <p>
          Loading any website shares your IP address and standard request data (such as your browser
          type and the page requested) with the servers involved. For Trainer Studio these are:
        </p>
        <LegalList>
          <li>
            The hosting provider that serves the site: Vercel (
            <OutboundLink href={VERCEL_PRIVACY_URL}>privacy policy</OutboundLink>).
          </li>
          <li>
            raw.githubusercontent.com (GitHub), which serves the Pokémon images (
            <OutboundLink href={GITHUB_PRIVACY_URL}>privacy statement</OutboundLink>).
          </li>
        </LegalList>
        <p>
          They handle this data under their own policies. We do not receive it and do not combine it
          with anything else. Fonts are served from this site itself.
        </p>
      </LegalSection>

      <LegalSection title="Deleting your data">
        <p>
          Use <strong>Settings → Reset progress</strong> to start over, or clear this site&apos;s
          data in your browser settings to remove everything the game stored. Because nothing is
          kept on a server, there is nothing else for us to delete.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Trainer Studio does not collect personal data from anyone, including children. The trainer
          name you type stays on your device.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          If this policy changes, the new version will be posted on this page with a new &ldquo;Last
          updated&rdquo; date. Changes that affect your data will also be noted in the
          project&apos;s GitHub repository.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
