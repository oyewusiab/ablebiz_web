export type Testimonial = {
  id: string;
  quote: string;
  name?: string;
  roleOrBusiness?: string;
  highlight?: boolean;
};

export const testimonials: Testimonial[] = [
  {
    id: "t1",
    quote: "ABLEBIZ made my registration smooth and stress-free. I got clear updates and my documents were delivered without stories.",
    name: "Client",
    roleOrBusiness: "Small Business Owner",
    highlight: true,
  },
  {
    id: "t2",
    quote: "Very professional and trustworthy service. Transparent pricing and they guided me from start to finish.",
    name: "Client",
    roleOrBusiness: "Entrepreneur",
  },
  {
    id: "t3",
    quote: "I finally registered my business without fear. The process was explained in simple terms and handled properly.",
    name: "Client",
    roleOrBusiness: "Startup Founder",
  },
  {
    id: "t4",
    quote: "Fast turnaround time and real-time updates. If you need a CAC agent in Abeokuta, I recommend ABLEBIZ.",
    name: "Client",
    roleOrBusiness: "SME Owner",
  },
];
