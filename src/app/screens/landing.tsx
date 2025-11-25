'use client';

import React, { useState, useEffect } from 'react';
import { Heart, MapPin, Bell, Shield, Users, Activity, Menu, X, ChevronRight, Zap, Award, Clock } from 'lucide-react';
import Link from 'next/link';

export default function BloodDonationLanding() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { value: '50K+', label: 'Active Donors', icon: Users },
    { value: '500+', label: 'Partner Hospitals', icon: Activity },
    { value: '100K+', label: 'Lives Saved', icon: Heart },
    { value: '24/7', label: 'Support Available', icon: Clock }
  ];

  const features = [
    {
      icon: MapPin,
      title: 'Smart Location Matching',
      description: 'AI-powered GIS technology matches donors with nearby hospitals in real-time based on blood type and availability.',
      color: 'from-red-500 to-pink-500'
    },
    {
      icon: Bell,
      title: 'Instant Notifications',
      description: 'Get immediate alerts when your blood type is urgently needed nearby. Every second counts in emergencies.',
      color: 'from-purple-500 to-indigo-500'
    },
    {
      icon: Shield,
      title: 'Privacy & Security',
      description: 'Your health data is encrypted and protected. We comply with HIPAA and international health data regulations.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Zap,
      title: 'Rapid Response',
      description: 'Emergency requests reach eligible donors within seconds. Our average response time is under 5 minutes.',
      color: 'from-orange-500 to-red-500'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Regular Donor',
      image: '👩‍⚕️',
      text: 'This platform made donating blood so convenient. I received a notification, confirmed availability, and saved a life - all within an hour!'
    },
    {
      name: 'Dr. Michael Chen',
      role: 'Hospital Administrator',
      image: '👨‍⚕️',
      text: 'The GIS matching system is revolutionary. We can now reach compatible donors instantly during critical emergencies.'
    },
    {
      name: 'Emily Rodriguez',
      role: 'Grateful Parent',
      image: '👩',
      text: 'When my daughter needed emergency surgery, donors responded within minutes through this platform. I am forever grateful.'
    }
  ];

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-pink-50">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-lg shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-12">
                <Heart className="w-7 h-7 text-white -rotate-12" fill="currentColor" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                  BloodConnect
                </h1>
                <p className="text-xs text-gray-600">Save Lives Together</p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-red-600 font-medium transition">Features</a>
              <a href="#how-it-works" className="text-gray-700 hover:text-red-600 font-medium transition">How It Works</a>
              <a href="#hospitals" className="text-gray-700 hover:text-red-600 font-medium transition">For Hospitals</a>
              <Link href="/auth/login">
                <button className="px-6 py-2.5 border-2 border-red-600 text-red-600 rounded-full font-semibold hover:bg-red-50 transition">
                  Sign In
                </button>
              </Link>
              <Link href="/auth/signup">
                <button className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition">
                  Get Started
                </button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden">
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t shadow-lg">
            <div className="px-4 py-6 space-y-4">
              <a href="#features" className="block text-gray-700 hover:text-red-600 font-medium">Features</a>
              <a href="#how-it-works" className="block text-gray-700 hover:text-red-600 font-medium">How It Works</a>
              <a href="#hospitals" className="block text-gray-700 hover:text-red-600 font-medium">For Hospitals</a>
              <Link href="/auth/login">
                <button className="w-full px-6 py-3 border-2 border-red-600 text-red-600 rounded-full font-semibold">
                  Sign In
                </button>
              </Link>
              <Link href="/auth/signup">
                <button className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-full font-semibold">
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" style={{animationDelay: '2s'}}></div>
          <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" style={{animationDelay: '4s'}}></div>
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center space-x-2 bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm font-semibold">
                <Zap className="w-4 h-4" />
                <span>Real-Time Blood Donation Network</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
                  Be a Hero.
                </span>
                <br />
                <span className="text-gray-900">Save a Life Today.</span>
              </h1>

              <p className="text-xl text-gray-600 leading-relaxed">
                Join the world's smartest blood donation network. Get matched with hospitals in need, receive instant notifications, and track your life-saving impact—all in one seamless platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth/signup">
                  <button className="group px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-full font-bold text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition flex items-center justify-center space-x-2">
                    <Heart className="w-5 h-5" fill="currentColor" />
                    <span>Become a Donor</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                  </button>
                </Link>
                <Link href="/auth/signup">
                  <button className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-full font-bold text-lg hover:border-red-600 hover:text-red-600 transition flex items-center justify-center space-x-2">
                    <Activity className="w-5 h-5" />
                    <span>For Hospitals</span>
                  </button>
                </Link>
              </div>

              <div className="flex items-center space-x-6 pt-4">
                <div className="flex -space-x-3">
                  {['🧑', '👩', '👨', '🧔'].map((emoji, i) => (
                    <div key={i} className="w-12 h-12 rounded-full bg-gradient-to-br from-red-100 to-pink-100 border-4 border-white flex items-center justify-center text-xl shadow-lg">
                      {emoji}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="font-bold text-gray-900">50,000+ Donors</p>
                  <p className="text-sm text-gray-600">Already saving lives</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-gray-900">Your Blood Type</h3>
                    <Award className="w-8 h-8 text-yellow-500" />
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {bloodTypes.map((type, i) => (
                      <button
                        key={type}
                        className="aspect-square rounded-xl bg-gradient-to-br from-red-500 to-pink-600 text-white font-bold text-xl hover:scale-110 transform transition shadow-lg hover:shadow-xl"
                        style={{animationDelay: `${i * 0.1}s`}}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 space-y-4">
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-gray-900">3 Urgent Requests Near You</p>
                        <p className="text-sm text-gray-600">Within 5km radius • Updated 2 min ago</p>
                      </div>
                    </div>
                    <Link href="/auth/signup">
                      <button className="w-full py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition">
                        View Nearby Requests
                      </button>
                    </Link>
                  </div>

                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                    <Shield className="w-4 h-4" />
                    <span>Your data is encrypted and secure</span>
                  </div>
                </div>
              </div>

              {/* Floating Cards */}
              <div className="absolute -top-6 -right-6 bg-white rounded-2xl shadow-xl p-4 animate-bounce">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Heart className="w-6 h-6 text-green-600" fill="currentColor" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">Life Saved!</p>
                    <p className="text-xs text-gray-600">Just now</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl mb-4 group-hover:scale-110 transition shadow-lg">
                  <stat.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </h3>
                <p className="text-gray-600 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-gray-900 mb-4">
              Why Choose <span className="bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">BloodConnect</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Cutting-edge technology meets compassionate care to create the most efficient blood donation network.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition border border-gray-100">
                <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl mb-6 group-hover:scale-110 transition shadow-lg`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-red-600 to-pink-600">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Stories That Matter</h2>
            <p className="text-red-100 text-lg">Real people. Real impact. Real lives saved.</p>
          </div>

          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl">
            <div className="text-center space-y-6">
              <div className="text-6xl mb-4">{testimonials[activeTestimonial].image}</div>
              <p className="text-xl text-gray-700 leading-relaxed italic">
                "{testimonials[activeTestimonial].text}"
              </p>
              <div>
                <p className="font-bold text-gray-900 text-lg">{testimonials[activeTestimonial].name}</p>
                <p className="text-gray-600">{testimonials[activeTestimonial].role}</p>
              </div>
            </div>

            <div className="flex justify-center space-x-2 mt-8">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  className={`w-3 h-3 rounded-full transition ${i === activeTestimonial ? 'bg-red-600 w-8' : 'bg-gray-300'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-red-600 to-pink-600 rounded-3xl p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE2YzAtMy4zMTQgMi42ODYtNiA2LTZzNiAyLjY4NiA2IDYtMi42ODYgNi02IDYtNi0yLjY4Ni02LTZ6TTI0IDM2YzAtMy4zMTQgMi42ODYtNiA2LTZzNiAyLjY4NiA2IDYtMi42ODYgNi02IDYtNi0yLjY4Ni02LTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
            
            <div className="relative z-10">
              <Heart className="w-16 h-16 text-white mx-auto mb-6" fill="currentColor" />
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Ready to Save Lives?
              </h2>
              <p className="text-xl text-red-100 mb-8 max-w-2xl mx-auto">
                Join thousands of heroes who are making a difference every day. Sign up now and start your journey.
              </p>
              <Link href="/auth/signup">
                <button className="px-10 py-5 bg-white text-red-600 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition inline-flex items-center space-x-3">
                  <span>Create Your Account</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </Link>
              <p className="text-red-100 text-sm mt-4">Free forever • No credit card required</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" fill="currentColor" />
                </div>
                <span className="text-xl font-bold">BloodConnect</span>
              </div>
              <p className="text-gray-400">Connecting donors with those in need, one life at a time.</p>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Platform</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition">For Donors</a></li>
                <li><a href="#" className="hover:text-white transition">For Hospitals</a></li>
                <li><a href="#" className="hover:text-white transition">How It Works</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition">About Us</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition">HIPAA Compliance</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>© 2024 BloodConnect. All rights reserved. Saving lives through technology.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
