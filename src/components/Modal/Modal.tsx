import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom';

type Props = {
  isOpened: boolean;
  children: ReactNode;
};

const Modal:React.FC<Props> = ({ isOpened, children }) => {
  if (!isOpened) return;

  const portalContainer = document.getElementById('portal');

  if (!portalContainer) return null;

  return ReactDOM.createPortal(
    <>
      <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 z-50" />

      <div className=" fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex justify-center items-center w-screen h-screen">
        {children}
      </div>
    </>,

    portalContainer
  );
};

export default Modal;