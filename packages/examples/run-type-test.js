import('./src/comprehensive-type-test.ts').then(module => {
  if (module.typeTests) {
    module.typeTests();
  }
}).catch(console.error);