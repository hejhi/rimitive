import { mount, router } from './service';
import { AppLayout } from './layouts/AppLayout';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Products } from './pages/Products';
import { Product } from './pages/Product';
import { NotFound } from './pages/NotFound';
import { RefSpec } from '@lattice/view/types';

// Define the application routes
const App = router.route('/', AppLayout())(
  router.route('', Home())(),
  router.route('about', About())(),
  router.route('products', Products())(router.route(':id', Product())()),
  // Catch-all route for 404
  router.route('*', NotFound())()
);

// Mount the app to the #app container
const container = document.querySelector('#app');
const appRef = mount(App.unwrap() as RefSpec<HTMLDivElement>);

if (container) container.appendChild(appRef.element!);
