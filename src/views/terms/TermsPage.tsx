import {
  CONTACT_URL,
  LegalDocument,
  LegalList,
  LegalSection,
  OutboundLink,
} from '@/shared/ui/LegalDocument';

const POKEAPI_URL = 'https://pokeapi.co';

/** Terms of use: a free, unofficial, non-commercial fan project provided as is. */
export function TermsPage() {
  return (
    <LegalDocument title="Terms">
      <LegalSection title="About Trainer Studio">
        <p>
          Trainer Studio is a free, non-commercial, unofficial fan project run by the GitHub user{' '}
          <strong>edgergard</strong>. By using the site you agree to these terms. If you do not
          agree, please do not use it.
        </p>
      </LegalSection>

      <LegalSection title="Not affiliated with the rights holders">
        <LegalList>
          <li>
            Trainer Studio is not affiliated with, endorsed, sponsored or approved by Nintendo, Game
            Freak, Creatures or The Pokémon Company.
          </li>
          <li>
            Pokémon names, images and related marks belong to their respective owners and are used
            here for a non-commercial fan project only.
          </li>
          <li>
            Pokémon data comes from <OutboundLink href={POKEAPI_URL}>PokéAPI</OutboundLink>.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Free and as is">
        <p>
          The game is free: there are no payments, ads or paid features. It is provided &ldquo;as
          is&rdquo; and &ldquo;as available&rdquo;, without warranty of any kind, express or
          implied. To the extent the law allows, the operator is not liable for any loss or damage
          arising from using the site.
        </p>
      </LegalSection>

      <LegalSection title="Your progress">
        <p>
          Your progress is stored only in your browser. It can be lost if you or your browser clear
          site data, if you use private browsing, or if you switch devices. Use{' '}
          <strong>Settings → Export</strong> regularly to keep a copy of your save.
        </p>
      </LegalSection>

      <LegalSection title="Removal requests">
        <p>
          If you hold rights to any content shown here and want it removed, open an issue at{' '}
          <OutboundLink href={CONTACT_URL}>GitHub Issues</OutboundLink>. Requests get a prompt
          response, and content is removed when the request is valid.
        </p>
      </LegalSection>

      <LegalSection title="Changes and governing law">
        <p>
          These terms may change; the current version is always on this page with its &ldquo;Last
          updated&rdquo; date. These terms are governed by the laws of Ukraine.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
