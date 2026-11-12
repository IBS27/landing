import {
  Accessibility,
  Briefcase,
  Code2,
  Cookie,
  CreditCard,
  FileText,
  Info,
  Lock,
  type LucideIcon,
  Megaphone,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

export type Policy = {
  slug: string;
  title: string;
  Icon: LucideIcon;
  /** "Terms and Policies" rows, or the footer's "More" menu. */
  group: "policies" | "more";
  updated: string;
  intro: string;
  sections: { heading: string; body: string }[];
};

export const POLICIES: Policy[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    Icon: Lock,
    group: "policies",
    updated: "June 16, 2026",
    intro:
      "This Privacy Policy explains how we collect, use and share your information when you use Facebook, and the choices you have.",
    sections: [
      {
        heading: "What information do we collect?",
        body: "We collect the information you give us when you sign up, create content and message people, along with information about how you use our Products, such as the posts you engage with and the features you use.",
      },
      {
        heading: "How do we use your information?",
        body: "We use information to provide, personalize and improve our Products, including your Feed, ads and suggested friends; to keep people safe; and to communicate with you.",
      },
      {
        heading: "How is your information shared?",
        body: "You choose the audience for what you share. Information is also shared with partners who help us deliver our services, under strict confidentiality obligations.",
      },
      {
        heading: "How can you manage your information?",
        body: "You can access, download and delete your information from Settings & privacy. Privacy Checkup walks you through the most important choices.",
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    Icon: FileText,
    group: "policies",
    updated: "January 1, 2026",
    intro:
      "These Terms govern your use of Facebook and the other products, features, apps and services we offer, except where we say that separate terms apply.",
    sections: [
      {
        heading: "The services we provide",
        body: "We help you connect with friends and communities, discover content you care about, and find businesses and causes that matter to you.",
      },
      {
        heading: "Your commitments to Facebook",
        body: "Use the same name you use in everyday life, provide accurate information, and don't use Facebook to do or share anything that's unlawful, misleading or that infringes someone else's rights.",
      },
      {
        heading: "Permissions you give us",
        body: "You own the content you create and share. When you share it, you give us a license to host, display and distribute it according to your privacy and app settings.",
      },
      {
        heading: "Limits on liability and disputes",
        body: 'We work hard to provide the best Products we can, but we provide them "as is". These Terms explain how disputes are resolved and which laws apply.',
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookies Policy",
    Icon: Cookie,
    group: "policies",
    updated: "March 4, 2026",
    intro:
      "Cookies are small pieces of text used to store information on web browsers. This policy explains how we use cookies and the choices you have.",
    sections: [
      {
        heading: "Why do we use cookies?",
        body: "Cookies help us keep you logged in, remember your preferences, keep your account secure and understand how people use our Products.",
      },
      {
        heading: "Where do we use cookies?",
        body: "We may place cookies on your computer or device when you visit Facebook and on websites and apps that use our technologies, like the Like button.",
      },
      {
        heading: "How can you control your cookies?",
        body: "You can review your cookie choices in Settings & privacy at any time, and most browsers let you block or delete cookies.",
      },
    ],
  },
  {
    slug: "community-standards",
    title: "Community Standards",
    Icon: ShieldCheck,
    group: "policies",
    updated: "August 20, 2026",
    intro:
      "Our Community Standards outline what is and isn't allowed on Facebook, so everyone can feel safe expressing themselves.",
    sections: [
      {
        heading: "Authenticity",
        body: "We want people to be confident that the people and communities they interact with are real. We don't allow fake accounts or coordinated inauthentic behavior.",
      },
      {
        heading: "Safety",
        body: "We remove content that could contribute to a risk of harm to people's physical security, including threats, bullying and harassment.",
      },
      {
        heading: "Privacy and dignity",
        body: "We remove content that shares people's private information or that degrades or shames them.",
      },
      {
        heading: "Reporting",
        body: "If you see something that goes against these standards, use the Report option on the post, profile or message so our teams can review it.",
      },
    ],
  },
  {
    slug: "advertising",
    title: "Advertising Policies",
    Icon: Megaphone,
    group: "policies",
    updated: "September 9, 2026",
    intro:
      "Advertising Standards give guidance on the types of ad content allowed for advertisers who run ads on Facebook.",
    sections: [
      {
        heading: "The ad review process",
        body: "Before ads show up on Facebook, they're reviewed to make sure they meet our Advertising Standards. Most ads are reviewed within 24 hours.",
      },
      {
        heading: "Prohibited content",
        body: "Ads must not promote illegal products or services, discriminatory practices, deceptive claims or unsafe supplements.",
      },
      {
        heading: "Restricted content",
        body: "Some categories, like alcohol, dating and financial services, can be advertised only with targeting and content restrictions.",
      },
    ],
  },
  {
    slug: "ad-choices",
    title: "Ad Choices",
    Icon: SlidersHorizontal,
    group: "policies",
    updated: "May 2, 2026",
    intro:
      "You have control over the ads you see. Learn how ads work on Facebook and how to make them more relevant to you.",
    sections: [
      {
        heading: "Why am I seeing this ad?",
        body: "Select ··· on any ad to see why it was shown to you, such as an advertiser trying to reach people of a certain age or in a certain location.",
      },
      {
        heading: "Ad preferences",
        body: "In Ad preferences you can see advertisers you've interacted with, hide ad topics and choose what information can be used to show you ads.",
      },
      {
        heading: "Ads off Facebook",
        body: "You can control whether information from partners about your activity on other websites and apps is used to show you ads.",
      },
    ],
  },
  {
    slug: "about",
    title: "About",
    Icon: Info,
    group: "more",
    updated: "October 1, 2026",
    intro:
      "Facebook's mission is to give people the power to build community and bring the world closer together.",
    sections: [
      {
        heading: "Our products",
        body: "People use Facebook to stay connected with friends and family, discover what's going on in the world, and share and express what matters to them.",
      },
      {
        heading: "Our company",
        body: "Facebook is part of Meta, which builds technologies that help people connect, find communities and grow businesses.",
      },
    ],
  },
  {
    slug: "careers",
    title: "Careers",
    Icon: Briefcase,
    group: "more",
    updated: "November 3, 2026",
    intro:
      "Build the future of human connection and the technology that makes it possible. Find a role that fits you.",
    sections: [
      {
        heading: "Teams",
        body: "Explore openings across engineering, design, product, research, data science, sales and infrastructure.",
      },
      {
        heading: "Locations",
        body: "We have offices around the world, including Seattle, Menlo Park, New York, London and Singapore, plus remote roles.",
      },
      {
        heading: "Life at Meta",
        body: "Our benefits support you and your family, from health and wellness to time off and learning.",
      },
    ],
  },
  {
    slug: "developers",
    title: "Meta for Developers",
    Icon: Code2,
    group: "more",
    updated: "July 22, 2026",
    intro:
      "Build with the tools and APIs that connect billions of people. Get started with documentation, SDKs and support.",
    sections: [
      {
        heading: "Graph API",
        body: "The primary way for apps to read and write to the social graph, with granular permissions people control.",
      },
      {
        heading: "Facebook Login",
        body: "A fast, convenient way for people to create accounts and log into your app across platforms.",
      },
      {
        heading: "Platform Terms",
        body: "Developers must follow the Platform Terms and Developer Policies when building on our platform.",
      },
    ],
  },
  {
    slug: "meta-pay",
    title: "Meta Pay",
    Icon: CreditCard,
    group: "more",
    updated: "April 18, 2026",
    intro:
      "Meta Pay lets you pay securely across Facebook, Messenger, Instagram and WhatsApp, and on supported websites.",
    sections: [
      {
        heading: "Pay and send money",
        body: "Shop, donate to fundraisers and send money to friends using a saved payment method.",
      },
      {
        heading: "Security",
        body: "Your card details are encrypted and stored securely. You can add a PIN or biometric check for extra protection.",
      },
      {
        heading: "Manage your settings",
        body: "Review your payment methods, contact information and payment history in Meta Pay settings.",
      },
    ],
  },
  {
    slug: "accessibility",
    title: "Accessibility",
    Icon: Accessibility,
    group: "more",
    updated: "February 12, 2026",
    intro:
      "We're committed to making Facebook accessible to everyone, including people with disabilities.",
    sections: [
      {
        heading: "Screen readers",
        body: "Facebook works with popular screen readers, and photos include automatically generated alternative text you can edit.",
      },
      {
        heading: "Keyboard shortcuts",
        body: "Navigate Facebook with keyboard shortcuts. Press ? while on Facebook to see the list.",
      },
      {
        heading: "Captions",
        body: "Videos can show automatically generated captions, and you can choose to always show them.",
      },
    ],
  },
];

export const policyBySlug = (slug: string) => POLICIES.find((p) => p.slug === slug);

/** Footer labels (FOOTER_LINKS) → policy slugs; "More" opens a menu instead. */
export const FOOTER_SLUGS: Record<string, string> = {
  Privacy: "privacy",
  Terms: "terms",
  Advertising: "advertising",
  "Ad Choices": "ad-choices",
  Cookies: "cookies",
};
