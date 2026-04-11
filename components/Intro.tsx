import React from 'react';
import { motion } from 'motion/react';

export const Intro: React.FC = () => {
  return (
    <motion.div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      {/* Background GIF */}
      <div className="absolute inset-0 w-full h-full">
        <img 
          src="https://media.giphy.com/media/e9CHZkJyCB8DzOZMIa/giphy.gif" 
          alt="BMW Background" 
          className="w-full h-full object-cover opacity-60"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
      </div>

      <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 text-center space-y-6"
        >
          <div className="space-y-2">
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white uppercase drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
              Tanque Certo
            </h1>
            <p className="text-white/80 font-bold tracking-[0.4em] uppercase text-sm md:text-base drop-shadow-md">
              Performance & Precisão
            </p>
          </div>
        </motion.div>
        
        {/* Decorative background elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[150px] animate-pulse" />
      </div>
    </motion.div>
  );
};
