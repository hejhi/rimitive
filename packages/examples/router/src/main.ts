import { mount, router } from './service';
import { AppLayout } from './layouts/AppLayout';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Products } from './pages/Products';
import { Product } from './pages/Product';
import { NotFound } from './pages/NotFound';

// Define the application routes using router.root()
// root() returns an element directly (not wrapped in show())
const { create, route } = router.root('/', AppLayout());

const App = create(
  route('', Home())(),
  route('about', About())(),
  route('products', Products())(route(':id', Product())()),
  // Catch-all route for 404
  route('*', NotFound())()
);

// Mount the app to the #app container
const container = document.querySelector('#app');
const appRef = mount(App);

if (container) container.appendChild(appRef.element as HTMLElement);
