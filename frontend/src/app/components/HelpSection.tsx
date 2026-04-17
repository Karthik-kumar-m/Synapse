export function HelpSection() {
  const helpCards = [
    {
      emoji: '💬',
      title: 'Get help buying',
      description: 'Have a question? Call a Specialist or chat online.',
      linkText: 'Chat with a Specialist',
      linkUrl: '#',
    },
    {
      emoji: '📦',
      title: 'Free and easy returns',
      description: 'Complete your return online or take it to an Apple Store.',
      linkText: 'Learn more about returns',
      linkUrl: '#',
    },
    {
      emoji: '🚚',
      title: 'Fast, free delivery',
      description: 'Get free delivery on all orders, or pick up in store.',
      linkText: 'Learn more about delivery',
      linkUrl: '#',
    },
  ];

  return (
    <section className="max-w-[1400px] mx-auto px-6 py-12">
      <h2 className="text-2xl font-semibold text-[#1D1D1F] mb-8">
        Need shopping help?
      </h2>

      <div className="grid grid-cols-3 gap-5">
        {helpCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-3xl p-8 border border-black/[0.06] hover:shadow-lg hover:shadow-black/5 transition-all duration-300"
          >
            <div className="text-4xl mb-4">{card.emoji}</div>
            <h3 className="text-xl font-semibold text-[#1D1D1F] mb-3">
              {card.title}
            </h3>
            <p className="text-sm text-[#86868B] mb-6 leading-relaxed">
              {card.description}
            </p>
            <a
              href={card.linkUrl}
              className="inline-flex items-center text-sm text-[#0066CC] hover:underline font-medium"
            >
              {card.linkText} →
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
