import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  Linkedin, 
  TrendingUp, 
  Users, 
  BarChart3, 
  Zap, 
  CheckCircle, 
  ArrowRight,
  Star,
  Quote,
  Sun,
  Moon
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface NavigationProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isDark: boolean;
  toggleTheme: () => void;
  onStartGrowing: () => void;
}

const Navigation = ({ activeSection, onNavigate, isDark, toggleTheme, onStartGrowing }: NavigationProps) => {
  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-modal backdrop-blur-xl border-b transition-colors ${
        isDark 
          ? 'bg-black/80 border-gray-800' 
          : 'bg-white/80 border-gray-200'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <motion.div 
            className="flex items-center space-x-2"
            whileHover={{ scale: 1.05 }}
          >
            <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
              <Linkedin size={20} className="text-white" />
            </div>
            <span className={`text-xl font-bold transition-colors ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>LinkedinGrowth</span>
          </motion.div>

          <div className="hidden md:flex items-center space-x-8">
            {['features', 'pricing', 'testimonials'].map((section) => (
              <button
                key={section}
                onClick={() => onNavigate(section)}
                className={`text-sm font-medium transition-colors capitalize ${
                  activeSection === section 
                    ? 'text-cyan-400' 
                    : isDark 
                      ? 'text-gray-300 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {section}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <motion.button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${
                isDark 
                  ? 'hover:bg-gray-700 text-gray-300' 
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </motion.button>
            
            <Button
              onClick={onStartGrowing}
              className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white font-semibold px-6 py-2"
            >
              Sign in with LinkedIn
            </Button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

const HeroSection = ({ isDark, onStartGrowing }: { isDark: boolean; onStartGrowing: () => void }) => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <section className={`min-h-screen relative overflow-hidden flex items-center transition-colors ${
      isDark 
        ? 'bg-black text-white' 
        : 'bg-gradient-to-br from-gray-50 to-blue-50 text-gray-900'
    }`}>
      {/* Background Pattern */}
      <div className={`absolute inset-0 ${
        isDark 
          ? 'bg-gradient-to-br from-black via-gray-900 to-black' 
          : 'bg-gradient-to-br from-white via-blue-50 to-cyan-50'
      }`}>
        <div className={`absolute inset-0 ${
          isDark 
            ? 'bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent_50%)]'
            : 'bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.05),transparent_50%)]'
        }`} />
      </div>

      <motion.div 
        style={{ y, opacity }}
        className="relative z-10 max-w-7xl mx-auto px-6 py-20"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`inline-flex items-center space-x-2 backdrop-blur-sm px-4 py-2 rounded-full border transition-colors ${
                isDark 
                  ? 'bg-gray-800/50 border-gray-700' 
                  : 'bg-white/50 border-gray-200'
              }`}
            >
              <Zap size={16} className="text-cyan-400" />
              <span className={`text-sm ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              }`}>Next-gen LinkedIn growth platform</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl lg:text-7xl font-bold leading-tight"
            >
              Grow your LinkedIn with{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                confidence & security
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`text-xl leading-relaxed max-w-2xl ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Experience seamless LinkedIn growth with advanced analytics, AI-powered content creation, and real-time insights. Start growing your professional network in minutes.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button
                onClick={onStartGrowing}
                size="lg"
                className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white font-semibold px-8 py-4 text-lg"
              >
                Start Growing Now
              </Button>
              <Button
                variant="outline"
                size="lg"
                className={`px-8 py-4 text-lg transition-colors ${
                  isDark 
                    ? 'border-gray-600 text-white hover:bg-gray-800' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                View Features
                <ArrowRight size={20} className="ml-2" />
              </Button>
            </motion.div>
          </div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotateY: 15 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="relative"
          >
            <div className={`backdrop-blur-xl rounded-2xl p-6 shadow-2xl transition-colors ${
              isDark 
                ? 'bg-gray-900/50 border-gray-700' 
                : 'bg-white/80 border-gray-200'
            }`}>
              {/* Mock Navigation Bar */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold text-xs">LG</span>
                  </div>
                  <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>LinkedinGrowth</span>
                </div>
                <div className="flex items-center space-x-4 text-xs">
                  <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Features</span>
                  <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Pricing</span>
                  <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Testimonials</span>
                  <div className="w-16 h-6 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-medium">Start</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">LG</span>
                </div>
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Welcome back, Professional!</h3>
                  <div className="flex items-center space-x-2">
                    <img
                      src="https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=40&h=40&dpr=1"
                      alt="Profile"
                      className="w-8 h-8 rounded-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={`rounded-lg p-4 ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                    <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>2.4K</div>
                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Engagement</div>
                  </div>
                  <div className={`rounded-lg p-4 ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
                    <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>+15%</div>
                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Growth Rate</div>
                  </div>
                </div>

                <div className={`rounded-lg p-4 ${isDark ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
                  <div className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Recent Activity</div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>New post published</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>5 new connections</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                      <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Analytics updated</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};

const FeaturesSection = ({ isDark }: { isDark: boolean }) => {
  const features = [
    {
      icon: TrendingUp,
      title: 'Real-time Analytics',
      description: 'Track your LinkedIn performance with live data from LinkedIn\'s DMA API',
      color: 'from-blue-500 to-cyan-500',
      accent: 'blue'
    },
    {
      icon: Users,
      title: 'Synergy Partners',
      description: 'Build meaningful connections and engage with your network strategically',
      color: 'from-purple-500 to-pink-500',
      accent: 'magenta'
    },
    {
      icon: BarChart3,
      title: 'Content Intelligence',
      description: 'AI-powered insights to optimize your content strategy and engagement',
      color: 'from-cyan-500 to-emerald-500',
      accent: 'cyan'
    },
    {
      icon: Zap,
      title: 'Algorithm Insights',
      description: 'Understand LinkedIn\'s algorithm and optimize your posting strategy',
      color: 'from-orange-500 to-pink-500',
      accent: 'magenta'
    }
  ];

  return (
    <section id="features" className={`py-20 transition-colors ${
      isDark 
        ? 'bg-gray-900 text-white' 
        : 'bg-white text-gray-900'
    }`}>
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Choose Your{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Growth
            </span>{' '}
            Features
          </h2>
          <p className={`text-xl max-w-3xl mx-auto ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Powerful tools designed to accelerate your LinkedIn presence with real data and AI-driven insights
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              className="group"
            >
              <div className={`p-6 h-full transition-all duration-300 rounded-2xl border ${
                isDark 
                  ? 'bg-gray-800/80 border-gray-700 hover:border-gray-600 shadow-xl' 
                  : 'bg-white border-gray-200 hover:border-gray-300 shadow-lg hover:shadow-xl'
              }`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon size={24} className="text-white" />
                </div>
                <h3 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{feature.title}</h3>
                <p className={`leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const PricingSection = ({ isDark, onStartGrowing }: { isDark: boolean; onStartGrowing: () => void }) => {
  const plans = [
    {
      name: 'Basic Growth',
      price: '$0',
      period: '/month',
      description: 'Perfect for professionals starting their LinkedIn journey',
      features: [
        'Basic analytics dashboard',
        'Content scheduling',
        'Basic engagement tracking',
        'Email support'
      ],
      popular: false,
      cta: 'Get Started Free'
    },
    {
      name: 'Pro Growth',
      price: '$49',
      period: '/month',
      description: 'Advanced features for serious LinkedIn growth',
      features: [
        'Advanced analytics & insights',
        'AI-powered content suggestions',
        'Synergy partner management',
        'Algorithm optimization',
        'Priority support',
        'API access'
      ],
      popular: true,
      cta: 'Start Free Trial'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'Enterprise-grade solutions for teams and organizations',
      features: [
        'Custom integrations',
        'Unlimited growth tools',
        'Team collaboration',
        'Dedicated account manager',
        'Custom API integration',
        '24/7 priority support'
      ],
      popular: false,
      cta: 'Contact Sales'
    }
  ];

  return (
    <section id="pricing" className={`py-20 transition-colors ${isDark ? 'bg-black text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Choose Your{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Growth
            </span>{' '}
            Plan
          </h2>
          <p className={`text-xl max-w-3xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Select the perfect plan with advanced features and competitive pricing
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div 
                className={`p-8 h-full rounded-2xl border transition-all duration-300 ${
                  plan.popular 
                    ? isDark 
                      ? 'bg-gray-800/90 border-cyan-400 shadow-2xl shadow-cyan-500/20' 
                      : 'bg-white border-cyan-400 shadow-2xl shadow-cyan-500/20'
                    : isDark 
                      ? 'bg-gray-800/70 border-gray-700 shadow-lg' 
                      : 'bg-white border-gray-200 shadow-lg hover:shadow-xl'
                }`}
              >
                <div className="text-center mb-8">
                  <h3 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                  <div className="flex items-baseline justify-center mb-4">
                    <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{plan.price}</span>
                    <span className={`ml-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{plan.period}</span>
                  </div>
                  <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{plan.description}</p>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center space-x-3">
                      <CheckCircle size={20} className="text-cyan-400 flex-shrink-0" />
                      <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={onStartGrowing}
                  className={`w-full ${
                    plan.popular
                      ? 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white'
                      : isDark 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  } font-semibold py-3`}
                >
                  {plan.cta}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            All plans include a 7-day free trial • 20% discount on annual plans
          </p>
        </motion.div>
      </div>
    </section>
  );
};

const TestimonialsSection = ({ isDark }: { isDark: boolean }) => {
  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Marketing Director',
      company: 'TechCorp',
      image: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1',
      content: 'LinkedinGrowth transformed my LinkedIn presence. The AI insights helped me increase engagement by 300% in just 2 months.',
      rating: 5
    },
    {
      name: 'Michael Chen',
      role: 'CEO',
      company: 'StartupXYZ',
      image: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1',
      content: 'The synergy features are game-changing. I\'ve built meaningful connections that led to actual business opportunities.',
      rating: 5
    },
    {
      name: 'Emily Rodriguez',
      role: 'Sales Manager',
      company: 'Enterprise Inc',
      image: 'https://images.pexels.com/photos/697509/pexels-photo-697509.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1',
      content: 'Real-time analytics give me the edge I need. I can see exactly what content resonates with my audience.',
      rating: 5
    }
  ];

  return (
    <section id="testimonials" className={`py-20 transition-colors ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            What Our{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Users
            </span>{' '}
            Say
          </h2>
          <p className={`text-xl max-w-3xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Join thousands of professionals who have accelerated their LinkedIn growth
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <div className={`p-6 h-full rounded-2xl border transition-all duration-300 ${
                isDark 
                  ? 'bg-gray-800/80 border-gray-700 hover:border-gray-600 shadow-lg hover:shadow-xl' 
                  : 'bg-white border-gray-200 hover:border-gray-300 shadow-lg hover:shadow-xl'
              }`}>
                <div className="flex items-center space-x-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} size={16} className="text-yellow-400 fill-current" />
                  ))}
                </div>
                
                <Quote size={24} className="text-pink-400 mb-4" />
                
                <p className={`mb-6 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  "{testimonial.content}"
                </p>
                
                <div className="flex items-center space-x-3">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <div className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{testimonial.name}</div>
                    <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {testimonial.role} at {testimonial.company}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const LandingPage = () => {
  const [activeSection, setActiveSection] = useState('hero');
  const [isDark, setIsDark] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'features', 'pricing', 'testimonials'];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigate = (section: string) => {
    const element = document.getElementById(section);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const handleStartGrowing = () => {
    // Direct to DMA OAuth instead of showing sign-in page
    console.log('Starting LinkedIn DMA OAuth...');
    window.location.href = '/.netlify/functions/linkedin-oauth-start';
  };

  return (
    <div className={`min-h-screen transition-colors ${isDark ? 'bg-black' : 'bg-white'}`}>
      <Navigation 
        activeSection={activeSection} 
        onNavigate={handleNavigate} 
        isDark={isDark}
        toggleTheme={toggleTheme}
        onStartGrowing={handleStartGrowing}
      />
      
      <div id="hero">
        <HeroSection isDark={isDark} onStartGrowing={handleStartGrowing} />
      </div>
      
      <div id="features">
        <FeaturesSection isDark={isDark} />
      </div>
      
      <div id="pricing">
        <PricingSection isDark={isDark} onStartGrowing={handleStartGrowing} />
      </div>
      
      <div id="testimonials">
        <TestimonialsSection isDark={isDark} />
      </div>

      {/* Footer */}
      <footer className={`border-t py-12 transition-colors ${
        isDark 
          ? 'bg-black border-gray-800' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                <Linkedin size={20} className="text-white" />
              </div>
              <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>LinkedinGrowth</span>
            </div>
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              © 2024 LinkedinGrowth. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
