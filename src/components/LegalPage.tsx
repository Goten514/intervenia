import React from 'react';

type LegalType = 'terms' | 'privacy' | 'cookies';

interface LegalPageProps {
  type: LegalType;
}

const CONTENT: Record<LegalType, { title: string; intro: string; sections: { h: string; p: string }[] }> = {
  terms: {
    title: "Conditions d'utilisation",
    intro:
      "Bienvenue sur InterventIA. En utilisant notre plateforme, vous acceptez les conditions suivantes qui encadrent l'usage de nos services d'intervention augmentée par IA.",
    sections: [
      { h: '1. Acceptation des conditions', p: "En accédant à InterventIA, vous reconnaissez avoir lu et accepté l'ensemble des présentes conditions. Si vous n'êtes pas d'accord, veuillez ne pas utiliser la plateforme." },
      { h: '2. Utilisation professionnelle', p: "InterventIA est un outil d'aide à l'intervention destiné aux professionnels qualifiés (psychoéducateurs, enseignants, intervenants). Les contenus générés ne remplacent pas le jugement clinique professionnel." },
      { h: '3. Compte utilisateur', p: "Vous êtes responsable de la confidentialité de vos identifiants et de toute activité réalisée depuis votre compte." },
      { h: '4. Propriété intellectuelle', p: "Les outils, contenus et marques d'InterventIA demeurent la propriété exclusive de la société. Les outils que vous générez vous appartiennent dans le cadre de votre usage professionnel." },
      { h: '5. Limitation de responsabilité', p: "InterventIA est fourni « tel quel ». Nous ne saurions être tenus responsables des décisions prises sur la base des contenus générés." },
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    intro:
      "La protection de vos données et de celles de vos clients est au cœur de notre mission. Cette politique explique comment nous collectons, utilisons et protégeons vos informations.",
    sections: [
      { h: '1. Données collectées', p: "Nous collectons les informations de votre compte (nom, courriel) ainsi que les données que vous saisissez pour générer des outils d'intervention." },
      { h: '2. Confidentialité des profils clients', p: "Les profils de vos clients sont privés, chiffrés et accessibles uniquement par votre compte. Nous ne vendons jamais vos données." },
      { h: '3. Conformité', p: "Nous respectons les lois québécoises et canadiennes en matière de protection des renseignements personnels (Loi 25)." },
      { h: '4. Sécurité', p: "Vos données sont hébergées sur des serveurs sécurisés avec chiffrement en transit et au repos." },
      { h: '5. Vos droits', p: "Vous pouvez à tout moment consulter, modifier ou supprimer vos données en nous contactant." },
    ],
  },
  cookies: {
    title: 'Politique relative aux cookies',
    intro:
      "InterventIA utilise des cookies pour assurer le bon fonctionnement de la plateforme et améliorer votre expérience.",
    sections: [
      { h: '1. Cookies essentiels', p: "Ils sont nécessaires au fonctionnement du site (authentification, sécurité, session) et ne peuvent être désactivés." },
      { h: '2. Cookies de mesure', p: "Ils nous aident à comprendre comment la plateforme est utilisée afin de l'améliorer, de manière anonyme et agrégée." },
      { h: '3. Gestion des cookies', p: "Vous pouvez configurer votre navigateur pour refuser les cookies non essentiels. Certaines fonctionnalités pourraient alors être limitées." },
      { h: '4. Durée de conservation', p: "Les cookies sont conservés pour une durée variable selon leur finalité, généralement entre une session et 12 mois." },
    ],
  },
};

const LegalPage: React.FC<LegalPageProps> = ({ type }) => {
  const data = CONTENT[type];
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{data.title}</h1>
        <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : 30 mai 2026</p>
        <p className="mt-6 text-slate-600">{data.intro}</p>
        <div className="mt-10 space-y-8">
          {data.sections.map((s) => (
            <div key={s.h}>
              <h2 className="text-lg font-semibold text-slate-900">{s.h}</h2>
              <p className="mt-2 leading-relaxed text-slate-600">{s.p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LegalPage;
